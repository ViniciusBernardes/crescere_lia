export function formatTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
