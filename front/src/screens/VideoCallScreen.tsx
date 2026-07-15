import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, RemoteTrackPublication, LocalTrackPublication } from 'livekit-client'
import { useLia } from '../context/LiaContext'

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
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const roomRef = useRef<Room | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)

  useEffect(() => {
    connectToRoom()
    return () => {
      roomRef.current?.disconnect()
    }
  }, [])

  async function connectToRoom() {
    try {
      const tokenData = await fetchVideoToken()
      if (!tokenData) {
        setError('Nenhuma videochamada ativa.')
        setStatus('ended')
        return
      }

      const room = new Room()
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current)
        }
      })

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach()
      })

      room.on(RoomEvent.Disconnected, () => {
        setStatus('ended')
      })

      await room.connect(tokenData.ws_url, tokenData.token)
      await room.localParticipant.enableCameraAndMicrophone()

      const localVideoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (localVideoTrack?.track && localVideoRef.current) {
        localVideoTrack.track.attach(localVideoRef.current)
      }

      setStatus('active')
    } catch (e) {
      console.error('[video] connection error:', e)
      setError('Falha ao conectar na videochamada.')
      setStatus('ended')
    }
  }

  async function fetchVideoToken(): Promise<VideoTokenData | null> {
    try {
      const res = await fetch(`${API_BASE}/chat/psych/video-token`, {
        headers: { 'X-Tenant-Slug': getTenantSlug() },
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  const toggleMic = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const enabled = !micEnabled
    room.localParticipant.setMicrophoneEnabled(enabled)
    setMicEnabled(enabled)
  }, [micEnabled])

  const toggleCam = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const enabled = !camEnabled
    room.localParticipant.setCameraEnabled(enabled)
    setCamEnabled(enabled)
  }, [camEnabled])

  const handleEnd = useCallback(() => {
    roomRef.current?.disconnect()
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
      </div>

      <div className="vc-local">
        <video ref={localVideoRef} autoPlay playsInline muted className="vc-local-video" />
      </div>

      <div className="vc-controls">
        <button
          type="button"
          className={`vc-ctrl-btn ${!micEnabled ? 'vc-off' : ''}`}
          onClick={toggleMic}
          aria-label={micEnabled ? 'Desativar microfone' : 'Ativar microfone'}
        >
          {micEnabled ? '🎙️' : '🔇'}
        </button>
        <button
          type="button"
          className={`vc-ctrl-btn ${!camEnabled ? 'vc-off' : ''}`}
          onClick={toggleCam}
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

function getTenantSlug(): string {
  const meta = document.querySelector('meta[name="tenant-slug"]')
  if (meta) return meta.getAttribute('content') || 'crescere'
  return import.meta.env.VITE_TENANT_SLUG || 'crescere'
}
