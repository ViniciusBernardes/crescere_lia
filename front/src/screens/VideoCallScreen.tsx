import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  VideoTrack,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useLia } from '../context/LiaContext'
import { getPsychApiHeaders } from '../services/sessionSync'

const API_BASE = '/api'

interface VideoTokenData {
  token: string
  ws_url: string
  room_name: string
  attendance_id?: number
}

export function VideoCallScreen() {
  const { showScreen, releasePsychRequest } = useLia()
  const [status, setStatus] = useState<'connecting' | 'active' | 'ended'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [tokenData, setTokenData] = useState<VideoTokenData | null>(null)
  const releasedRef = useRef(false)
  const attendanceIdRef = useRef<number | null>(null)

  const leavePsychQueue = useCallback(async (keepalive = false) => {
    if (releasedRef.current) return
    releasedRef.current = true

    const attendanceId = attendanceIdRef.current
    try {
      await fetch(`${API_BASE}/chat/psych/video-end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getPsychApiHeaders(),
        },
        body: JSON.stringify(
          attendanceId ? { attendance_id: attendanceId } : {},
        ),
        keepalive,
      })
    } catch {
      // best-effort — o release abaixo ainda zera a fila
    }

    await releasePsychRequest({ keepalive }).catch(() => undefined)
  }, [releasePsychRequest])

  useEffect(() => {
    let cancelled = false

    async function loadToken() {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await fetch(`${API_BASE}/chat/psych/video-token`, {
            headers: getPsychApiHeaders(),
          })
          if (cancelled) return
          if (res.ok) {
            const data = (await res.json()) as VideoTokenData
            if (data.attendance_id) {
              attendanceIdRef.current = data.attendance_id
            }
            setTokenData(data)
            setStatus('active')
            return
          }
          if (res.status === 404 && attempt < 4) {
            await new Promise((r) => setTimeout(r, 2000))
            continue
          }
          setError('Nenhuma videochamada ativa.')
          setStatus('ended')
          return
        } catch {
          if (attempt < 4) {
            await new Promise((r) => setTimeout(r, 2000))
            continue
          }
          if (!cancelled) {
            setError('Falha ao conectar na videochamada.')
            setStatus('ended')
          }
          return
        }
      }
    }

    void loadToken()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onLeave = () => {
      void leavePsychQueue(true)
    }
    window.addEventListener('pagehide', onLeave)
    return () => window.removeEventListener('pagehide', onLeave)
  }, [leavePsychQueue])

  const handleEnd = useCallback(() => {
    setTokenData(null)
    setStatus('ended')
    void leavePsychQueue()
  }, [leavePsychQueue])

  if (status === 'ended') {
    return (
      <div className="video-call-screen">
        <div className="vc-ended">
          <div className="vc-ended-icon">💜</div>
          <p>{error || 'Videochamada encerrada.'}</p>
          <button
            type="button"
            className="vc-back-btn"
            onClick={() => {
              void leavePsychQueue()
              showScreen('chat')
            }}
          >
            Voltar ao chat
          </button>
        </div>
      </div>
    )
  }

  if (!tokenData) {
    return (
      <div className="video-call-screen">
        <div className="vc-connecting">
          <div className="vc-spinner" />
          <p>Conectando videochamada…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="video-call-screen">
      <LiveKitRoom
        token={tokenData.token}
        serverUrl={tokenData.ws_url}
        connect
        // Igual ao telemedicina: getUserMedia no SignalConnected libera autoplay
        // ANTES dos tracks remotos chegarem.
        audio
        video
        onDisconnected={() => {
          setStatus('ended')
        }}
        onError={(err) => {
          console.error('[video] livekit error:', err)
        }}
        className="vc-livekit-room"
      >
        <RoomAudioRenderer />
        <StartAudio label="Toque para ativar o som" className="vc-unmute-btn" />
        <VideoCallRoom onEnd={handleEnd} />
      </LiveKitRoom>
    </div>
  )
}

function VideoCallRoom({ onEnd }: { onEnd: () => void }) {
  const room = useRoomContext()
  const { isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const hasRemoteParticipant = remoteParticipants.length > 0
  const [mediaWarning, setMediaWarning] = useState<string | null>(null)

  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true },
  )
  const remoteVideoTracks = tracks.filter((t) => !t.participant.isLocal)
  const localTracks = tracks.filter(
    (t) => t.participant.isLocal && t.source === Track.Source.Camera,
  )

  useEffect(() => {
    // Garante resume do playback depois do unlock via getUserMedia.
    void room.startAudio().catch(() => undefined)
  }, [room])

  useEffect(() => {
    const issues: string[] = []
    if (!isMicrophoneEnabled) issues.push('microfone')
    if (!isCameraEnabled) issues.push('câmera')
    if (issues.length > 0) {
      setMediaWarning(
        `Não foi possível acessar ${issues.join(' e ')}. Você ainda pode ver e ouvir o psicólogo.`,
      )
    } else {
      setMediaWarning(null)
    }
  }, [isCameraEnabled, isMicrophoneEnabled])

  return (
    <>
      <div className="vc-remote">
        {remoteVideoTracks.length > 0 ? (
          <VideoTrack
            trackRef={remoteVideoTracks[0]}
            className="vc-remote-video"
          />
        ) : (
          <div className="vc-remote-placeholder">
            {hasRemoteParticipant
              ? 'Psicólogo conectado — câmera desativada'
              : 'Aguardando o psicólogo…'}
          </div>
        )}
      </div>

      {localTracks.length > 0 && (
        <div className="vc-local">
          <VideoTrack
            trackRef={localTracks[0]}
            className="vc-local-video"
          />
        </div>
      )}

      {mediaWarning && <div className="vc-media-warning">{mediaWarning}</div>}

      <div className="vc-controls">
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon={false}
          className={`vc-ctrl-btn ${!isMicrophoneEnabled ? 'vc-off' : ''}`}
        >
          {isMicrophoneEnabled ? '🎙️' : '🔇'}
        </TrackToggle>
        <TrackToggle
          source={Track.Source.Camera}
          showIcon={false}
          className={`vc-ctrl-btn ${!isCameraEnabled ? 'vc-off' : ''}`}
        >
          {isCameraEnabled ? '📷' : '🚫'}
        </TrackToggle>
        <button
          type="button"
          className="vc-ctrl-btn vc-end"
          onClick={onEnd}
          aria-label="Encerrar chamada"
        >
          📞
        </button>
      </div>
    </>
  )
}
