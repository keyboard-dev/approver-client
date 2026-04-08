import React from 'react'

interface State {
  hasError: boolean
}

/**
 * Top-level error boundary to prevent unhandled render errors from
 * blanking the entire app. Renders a minimal recovery UI when caught.
 */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Caught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center p-8 max-w-sm">
            <p className="text-[14px] text-[#737373] dark:text-[#a9a9a9]">
              Something went wrong.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="text-[13px] text-[#99A0FF] hover:opacity-80 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
