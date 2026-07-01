export interface RecorderFormat {
  mimeType: string
  extension: string
}

const WEB_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
]

const IOS_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/aac', extension: 'm4a' },
  { mimeType: 'audio/mp4;codecs=mp4a', extension: 'm4a' },
]

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function canUseMicrophone(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

function formatCandidates(): RecorderFormat[] {
  if (isIOSDevice()) {
    return [...IOS_FORMATS, ...WEB_FORMATS]
  }
  return [...WEB_FORMATS, ...IOS_FORMATS]
}

export function getRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') return null

  const supported = formatCandidates().find((format) => MediaRecorder.isTypeSupported(format.mimeType))
  if (supported) return supported

  return { mimeType: '', extension: isIOSDevice() ? 'm4a' : 'webm' }
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('aac') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export function createMediaRecorder(
  stream: MediaStream,
  preferred: RecorderFormat,
): { recorder: MediaRecorder; format: RecorderFormat } {
  if (preferred.mimeType) {
    try {
      const recorder = new MediaRecorder(stream, { mimeType: preferred.mimeType })
      return {
        recorder,
        format: { mimeType: recorder.mimeType || preferred.mimeType, extension: preferred.extension },
      }
    } catch {
      /* tenta gravador padrão da plataforma */
    }
  }

  const recorder = new MediaRecorder(stream)
  const mimeType = recorder.mimeType || (isIOSDevice() ? 'audio/mp4' : 'audio/webm')
  return {
    recorder,
    format: { mimeType, extension: extensionFromMime(mimeType) },
  }
}

export function micErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  const ios = isIOSDevice()

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    if (ios) {
      return 'Não consegui acessar o microfone. Toque em "Permitir" se o iPhone pedir. Se estiver no modo Privado do Safari, abra o site em uma aba normal ou em Ajustes > Safari > Microfone permita para este site. 💙'
    }
    return 'Permita o acesso ao microfone nas configurações do navegador para enviar áudio. 💙'
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhum microfone encontrado neste dispositivo. Escreva sua mensagem no campo de texto. 💙'
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'O microfone está em uso por outro app. Feche-o e tente de novo. 💙'
  }

  if (ios) {
    return 'Gravação indisponível neste iPhone agora. Escreva sua mensagem ou tente em uma aba normal do Safari. 💙'
  }

  return 'Não foi possível gravar áudio. Escreva sua mensagem no campo de texto. 💙'
}
