import { useMemo } from 'react'
import { useLia } from '../../context/LiaContext'
import { cleanSpeechText } from '../../hooks/useSpeech'
import { formatAudioTime, waveformHeights } from '../../utils/audioTime'
import { ListenButton } from './ChatParts'

const BAR_COUNT = 32

export function AudioMessagePlayer({ text }: { text: string }) {
  const {
    speechLoading,
    speechPlayback,
    toggleSpeech,
    seekSpeech,
    isSpeechReady,
    getSpeechDuration,
    primeAudio,
  } = useLia()

  const key = cleanSpeechText(text)
  const loading = speechLoading === key
  const ready = isSpeechReady(text)
  const bars = useMemo(() => waveformHeights(key, BAR_COUNT), [key])

  if (!ready) {
    return <ListenButton text={text} onListen={toggleSpeech} onPrime={primeAudio} loading={loading} />
  }

  const isActive = speechPlayback.text === key
  const playing = isActive && speechPlayback.playing
  const duration = isActive && speechPlayback.duration > 0 ? speechPlayback.duration : getSpeechDuration(text)
  const progress =
    isActive && speechPlayback.duration > 0 ? speechPlayback.currentTime / speechPlayback.duration : 0
  const filledBars = Math.round(progress * BAR_COUNT)

  const handleWaveClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    seekSpeech(text, ratio)
  }

  const timeLabel =
    playing || (isActive && speechPlayback.currentTime > 0)
      ? formatAudioTime(speechPlayback.currentTime)
      : formatAudioTime(duration)

  return (
    <div className="audio-player">
      <button
        type="button"
        className="audio-player-btn"
        onPointerDown={() => primeAudio()}
        onClick={() => toggleSpeech(text)}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="audio-player-body">
        <div
          className="audio-wave"
          onClick={handleWaveClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleSpeech(text)
            }
          }}
          role="slider"
          aria-label="Progresso do áudio"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
        >
          {bars.map((h, i) => (
            <span
              key={i}
              className={`audio-wave-bar${i < filledBars ? ' filled' : ''}`}
              style={{ height: `${h}%` }}
            />
          ))}
          <span className="audio-wave-dot" style={{ left: `${progress * 100}%` }} aria-hidden />
        </div>
        <span className="audio-player-time">{timeLabel}</span>
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="8 5 19 12 8 19" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}
