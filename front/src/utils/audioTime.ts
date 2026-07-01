export function formatAudioTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function waveformHeights(seedText: string, count: number): number[] {
  let seed = 0
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0
  }

  return Array.from({ length: count }, (_, i) => {
    seed = (seed * 1664525 + 1013904223 + i) >>> 0
    return 28 + (seed % 62)
  })
}
