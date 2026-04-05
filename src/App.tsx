import { ChatProvider } from './context/ChatContext'
import { ChatShell } from './components/ChatShell'
import { HomePage } from './components/HomePage'
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
    if (nextPath === path) {
      return
    }

    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  if (path === '/' || path === '') {
    return <HomePage onOpenChat={() => navigate('/chat')} />
  }

  return (
    <ChatProvider>
      <ChatShell onGoHome={() => navigate('/')} />
    </ChatProvider>
  )
}

export default App
