import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminScreen } from './screens/AdminScreen.tsx'

const isAdminRoute = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isAdminRoute ? <AdminScreen /> : <App />}</StrictMode>,
)
