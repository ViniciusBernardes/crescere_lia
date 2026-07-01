export interface RecorderFormat {
  mimeType: string
  extension: string
}

const FORMAT_CANDIDATES: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
]

export function canUseMicrophone(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

export function getRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') return null
  return FORMAT_CANDIDATES.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null
}
