import type { ChatResponse } from './liaApi'
import { cacheSpeech, speechBlobFromBase64 } from './ttsCache'

export function prepareSpeechFromResponse(
  response: Pick<ChatResponse, 'audioText' | 'speechAudio'>,
): Blob | undefined {
  const blob = speechBlobFromBase64(response.speechAudio)
  if (blob && response.audioText) {
    cacheSpeech(response.audioText, blob)
  }
  return blob
}
