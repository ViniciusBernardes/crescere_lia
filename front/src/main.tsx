import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AdminScreen } from './screens/AdminScreen.tsx'

const isAdminRoute = window.location.pathname.startsWith('/admin')

if (isAdminRoute) {
  document.documentElement.classList.add('admin-route')
}

const root = createRoot(document.getElementById('root')!)

if (isAdminRoute) {
  root.render(
    <StrictMode>
      <AdminScreen />
    </StrictMode>,
  )
} else {
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
