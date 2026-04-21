'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error)
    }
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center"
      >
        <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center mb-4" aria-hidden="true">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">משהו השתבש</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-sm">
          התרחשה שגיאה לא צפויה. ננסה שוב? אם הבעיה חוזרת, רענן את הדף.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={this.reset}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 min-h-[52px] text-white font-bold active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            נסה שוב
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-2xl py-3 min-h-[48px] font-bold text-gray-700 bg-white border border-gray-200 active:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            רענן את הדף
          </button>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <pre className="mt-6 text-[10px] text-gray-400 max-w-full overflow-x-auto whitespace-pre-wrap" dir="ltr">
            {error.message}
          </pre>
        )}
      </div>
    )
  }
}
