import { ChatProvider } from './context/ChatContext'
import { ChatShell } from './components/ChatShell'
import { HomePage } from './components/HomePage'
import { LoginPage } from './components/LoginPage'
import { useEffect, useState } from 'react'

function getCurrentPath() {
  return window.location.pathname || '/'
}

function App() {
  const [path, setPath] = useState(getCurrentPath)

  useEffect(() => {
    const handlePopState = () => setPath(getCurrentPath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPath: string) => {
    if (nextPath === path) return
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  // Landing / marketing home
  if (path === '/' || path === '') {
    return <HomePage onOpenChat={() => navigate('/login')} />
  }

  // Login page – needs ChatProvider so LoginPage can call chat.login()
  if (path === '/login') {
    return (
      <ChatProvider>
        <LoginPage onLoginSuccess={() => navigate('/chat')} />
      </ChatProvider>
    )
  }

  // Chat workspace
  return (
    <ChatProvider>
      <ChatShell
        onGoHome={() => navigate('/')}
        onGoLogin={() => navigate('/login')}
      />
    </ChatProvider>
  )
}

export default App
