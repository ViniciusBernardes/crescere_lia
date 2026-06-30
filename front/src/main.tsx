import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminScreen } from './screens/AdminScreen.tsx'

const isAdminRoute = window.location.pathname.startsWith('/admin')

if (isAdminRoute) {
  document.documentElement.classList.add('admin-route')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isAdminRoute ? <AdminScreen /> : <App />}</StrictMode>,
)
