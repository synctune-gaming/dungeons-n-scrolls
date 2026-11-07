import { Component, StrictMode } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/im-fell-english/400.css'
import '@fontsource/im-fell-english/400-italic.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-mono/400.css'
import App from './App'
import './styles.css'

class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The adventure could not render:', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return <main className="fatal-error"><h1>The path went dark.</h1><p>The adventure could not load. Reload to try again; your last saved step will remain.</p><button className="gold-button" onClick={() => window.location.reload()}>Reload the adventure</button></main>
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('The adventure cannot start because its root element is missing.')

createRoot(root).render(<StrictMode><GameErrorBoundary><App /></GameErrorBoundary></StrictMode>)
