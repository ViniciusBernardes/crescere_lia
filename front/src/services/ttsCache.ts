function speechKey(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const cache = new Map<string, Blob>()

export function getCachedSpeech(text: string): Blob | undefined {
  const key = speechKey(text)
  return key ? cache.get(key) : undefined
}

export function cacheSpeech(text: string, blob: Blob): void {
  const key = speechKey(text)
  if (!key) return
  cache.set(key, blob)
}

export function speechBlobFromBase64(base64?: string): Blob | undefined {
  if (!base64) return undefined

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: 'audio/mpeg' })
}
