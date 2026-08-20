import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AdminApp } from './screens/AdminApp.tsx'

const isAdminRoute = window.location.pathname.startsWith('/admin')
const isPrivacyRoute = window.location.pathname.startsWith('/privacidade')
const isTermsRoute = window.location.pathname.startsWith('/termos')
const isHelpRoute = window.location.pathname.startsWith('/ajuda')
const isFeedbackRoute = window.location.pathname.startsWith('/feedback')

if (isAdminRoute) {
  document.documentElement.classList.add('admin-route')
}

const root = createRoot(document.getElementById('root')!)

if (isAdminRoute) {
  root.render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  )
} else if (isPrivacyRoute || isTermsRoute || isHelpRoute || isFeedbackRoute) {
  // Páginas estáticas em /public; se o SPA capturou a rota, força o arquivo.
  const target = isTermsRoute
    ? '/termos/index.html'
    : isHelpRoute
      ? '/ajuda/index.html'
      : isFeedbackRoute
        ? '/feedback/index.html'
        : '/privacidade/index.html'
  if (!window.location.pathname.endsWith('index.html')) {
    window.location.replace(target)
  }
} else {
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
