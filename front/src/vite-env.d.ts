/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PROXY_TARGET?: string
  readonly VITE_USE_AI_CHAT?: string
  readonly VITE_TENANT_SLUG?: string
  readonly VITE_SHOW_JOURNEYS?: string
  readonly VITE_SHOW_EMOTIONAL_MAP?: string
  readonly VITE_SHOW_QUICK_REPLIES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
