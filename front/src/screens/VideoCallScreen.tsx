import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client'
import { useLia } from '../context/LiaContext'
import { getPsychApiHeaders } from '../services/sessionSync'

const API_BASE = '/api'

interface VideoTokenData {
  token: string
  ws_url: string
  room_name: string
}

export function VideoCallScreen() {
  const { showScreen } = useLia()
  const [status, setStatus] = useState<'connecting' | 'active' | 'ended'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [mediaWarning, setMediaWarning] = useState<string | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const roomRef = useRef<Room | null>(null)
  const connectingRef = useRef(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)

  const attachRemoteTrack = useCallback((track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
      track.attach(remoteVideoRef.current)
    }
    if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
      track.attach(remoteAudioRef.current)
    }
  }, [])

  const attachExistingRemoteTracks = useCallback(
    (room: Room) => {
      room.remoteParticipants.forEach((participant: RemoteParticipant) => {
        participant.trackPublications.forEach((publication: RemoteTrackPublication) => {
          if (publication.track) {
            attachRemoteTrack(publication.track)
          }
        })
      })
    },
    [attachRemoteTrack],
  )

  const attachLocalCamera = useCallback((room: Room) => {
    const localVideoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)
    if (localVideoTrack?.track && localVideoRef.current) {
      localVideoTrack.track.attach(localVideoRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function connectToRoom() {
      if (connectingRef.current) return
      connectingRef.current = true

      try {
        const tokenData = await fetchVideoToken()
        if (cancelled) return

        if (!tokenData) {
          setError('Nenhuma videochamada ativa.')
          setStatus('ended')
          return
        }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        })
        roomRef.current = room

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          attachRemoteTrack(track)
        })

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach()
        })

        room.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
          if (publication.source === Track.Source.Camera && publication.track && localVideoRef.current) {
            publication.track.attach(localVideoRef.current)
          }
        })

        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setStatus('ended')
        })

        await room.connect(tokenData.ws_url, tokenData.token)
        if (cancelled) {
          room.disconnect()
          return
        }

        attachExistingRemoteTracks(room)
        setStatus('active')

        try {
          await room.localParticipant.setCameraEnabled(true)
          await room.localParticipant.setMicrophoneEnabled(true)
          setCamEnabled(true)
          setMicEnabled(true)
          attachLocalCamera(room)
        } catch (mediaError) {
          console.warn('[video] camera/mic unavailable:', mediaError)
          setMediaWarning(
            'Não foi possível acessar câmera ou microfone. Você ainda pode ver e ouvir o psicólogo.',
          )
          setCamEnabled(false)
          setMicEnabled(false)
        }
      } catch (e) {
        console.error('[video] connection error:', e)
        if (!cancelled) {
          setError('Falha ao conectar na videochamada.')
          setStatus('ended')
        }
      } finally {
        connectingRef.current = false
      }
    }

    void connectToRoom()

    return () => {
      cancelled = true
      const room = roomRef.current
      roomRef.current = null
      room?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchVideoToken(): Promise<VideoTokenData | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/chat/psych/video-token`, {
          headers: getPsychApiHeaders(),
        })
        if (res.ok) return await res.json()
        if (res.status === 404 && attempt < 4) {
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }
        return null
      } catch {
        if (attempt < 4) {
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }
        return null
      }
    }
    return null
  }

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const enabled = !micEnabled
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled)
      setMicEnabled(enabled)
      setMediaWarning(null)
    } catch {
      setMediaWarning('Não foi possível alterar o microfone.')
    }
  }, [micEnabled])

  const toggleCam = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const enabled = !camEnabled
    try {
      await room.localParticipant.setCameraEnabled(enabled)
      setCamEnabled(enabled)
      if (enabled) attachLocalCamera(room)
      setMediaWarning(null)
    } catch {
      setMediaWarning('Não foi possível alterar a câmera.')
    }
  }, [attachLocalCamera, camEnabled])

  const handleEnd = useCallback(() => {
    roomRef.current?.disconnect()
    roomRef.current = null
    setStatus('ended')
  }, [])

  if (status === 'ended') {
    return (
      <div className="video-call-screen">
        <div className="vc-ended">
          <div className="vc-ended-icon">💜</div>
          <p>{error || 'Videochamada encerrada.'}</p>
          <button type="button" className="vc-back-btn" onClick={() => showScreen('chat')}>
            Voltar ao chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="video-call-screen">
      {status === 'connecting' && (
        <div className="vc-connecting">
          <div className="vc-spinner" />
          <p>Conectando videochamada…</p>
        </div>
      )}

      <div className="vc-remote">
        <video ref={remoteVideoRef} autoPlay playsInline className="vc-remote-video" />
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      <div className="vc-local">
        <video ref={localVideoRef} autoPlay playsInline muted className="vc-local-video" />
      </div>

      {mediaWarning && <div className="vc-media-warning">{mediaWarning}</div>}

      <div className="vc-controls">
        <button
          type="button"
          className={`vc-ctrl-btn ${!micEnabled ? 'vc-off' : ''}`}
          onClick={() => void toggleMic()}
          aria-label={micEnabled ? 'Desativar microfone' : 'Ativar microfone'}
        >
          {micEnabled ? '🎙️' : '🔇'}
        </button>
        <button
          type="button"
          className={`vc-ctrl-btn ${!camEnabled ? 'vc-off' : ''}`}
          onClick={() => void toggleCam()}
          aria-label={camEnabled ? 'Desativar camera' : 'Ativar camera'}
        >
          {camEnabled ? '📷' : '🚫'}
        </button>
        <button
          type="button"
          className="vc-ctrl-btn vc-end"
          onClick={handleEnd}
          aria-label="Encerrar chamada"
        >
          📞
        </button>
      </div>
    </div>
  )
}
