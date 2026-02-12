import React, { Component, ErrorInfo, ReactNode } from 'react';

// ════════════════════════════════════════════════════════════════════
// ReceiverErrorBoundary
//
// Wraps the receiver-facing stages (PersonalIntro → Envelope →
// InteractiveQuestion → SoulmateSync → MainExperience).
//
// If any child crashes during rendering, shows a graceful fallback
// instead of a white screen. This matters because someone PAID for
// this experience to be delivered.
//
// Usage in App.tsx:
//   <ReceiverErrorBoundary>
//     <MainExperience data={data} ... />
//   </ReceiverErrorBoundary>
// ════════════════════════════════════════════════════════════════════

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ReceiverErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ReceiverErrorBoundary] Caught:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black p-8">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-8">
              <span className="text-2xl">💌</span>
            </div>

            <h1
              className="text-2xl italic mb-4"
              style={{ color: '#E5D0A1', fontFamily: 'Georgia, serif' }}
            >
              Something went wrong
            </h1>

            <p
              className="text-sm mb-8 leading-relaxed"
              style={{ color: 'rgba(229,208,161,0.6)' }}
            >
              Your message is safe. Please try refreshing the page.
              If the problem continues, the link will still work — just try again in a moment.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 rounded-full text-xs uppercase tracking-widest font-bold transition-all"
              style={{
                color: '#E5D0A1',
                border: '1px solid rgba(212,175,55,0.3)',
                backgroundColor: 'rgba(212,175,55,0.05)',
              }}
            >
              Refresh Page
            </button>

            <button
              onClick={this.handleRetry}
              className="block mx-auto mt-4 text-xs uppercase tracking-widest transition-all"
              style={{ color: 'rgba(229,208,161,0.4)' }}
            >
              Try Again Without Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}