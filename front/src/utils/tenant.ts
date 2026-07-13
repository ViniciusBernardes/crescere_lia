export function resolveTenantSlug(): string {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('tenant')?.trim().toLowerCase()
  if (fromUrl) return fromUrl

  return (import.meta.env.VITE_TENANT_SLUG || 'crescere').trim().toLowerCase()
}
