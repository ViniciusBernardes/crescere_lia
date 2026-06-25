import { PhoneFrame, StatusBar } from './components/layout/PhoneFrame'
import { PsychOverlay } from './components/overlays/PsychOverlay'
import { LiaProvider, useLia } from './context/LiaContext'
import { ChatScreen } from './screens/ChatScreen'
import { IntroScreen } from './screens/IntroScreen'
import { JourneyScreen } from './screens/JourneyScreen'
import { MapScreen } from './screens/MapScreen'
import './styles/lia.css'

function AppShell() {
  const { screen } = useLia()

  return (
    <PhoneFrame>
      <StatusBar />
      {screen === 'intro' && <IntroScreen />}
      {screen === 'chat' && <ChatScreen />}
      {screen === 'journey' && <JourneyScreen />}
      {screen === 'map' && <MapScreen />}
      <PsychOverlay />
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
