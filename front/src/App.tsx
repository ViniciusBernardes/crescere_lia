import { PhoneFrame } from './components/layout/PhoneFrame'
import { IdleOverlay } from './components/overlays/IdleOverlay'
import { PsychOverlay } from './components/overlays/PsychOverlay'
import { LiaProvider, useLia } from './context/LiaContext'
import { showJourneys } from './lib/features'
import { ChatScreen } from './screens/ChatScreen'
import { IntroScreen } from './screens/IntroScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen'
import { ResetPasswordScreen } from './screens/ResetPasswordScreen'
import { JourneyScreen } from './screens/JourneyScreen'
import { MapScreen } from './screens/MapScreen'
import { PsychChatScreen } from './screens/PsychChatScreen'
import { VideoCallScreen } from './screens/VideoCallScreen'
import './styles/lia.css'

function AppShell() {
  const { screen } = useLia()

  return (
    <PhoneFrame>
      {screen === 'login' && <LoginScreen />}
      {screen === 'forgotPassword' && <ForgotPasswordScreen />}
      {screen === 'resetPassword' && <ResetPasswordScreen />}
      {screen === 'intro' && <IntroScreen />}
      {screen === 'chat' && <ChatScreen />}
      {screen === 'journey' && showJourneys() && <JourneyScreen />}
      {screen === 'map' && <MapScreen />}
      {screen === 'psychChat' && <PsychChatScreen />}
      {screen === 'videoCall' && <VideoCallScreen />}
      <PsychOverlay />
      <IdleOverlay />
    </PhoneFrame>
  )
}

export default function App() {
  return (
    <LiaProvider>
      <AppShell />
    </LiaProvider>
  )
}
