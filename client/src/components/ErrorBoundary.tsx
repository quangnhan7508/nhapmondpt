import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Khung chặn crash toàn app: hiện lỗi + nút tải lại thay vì trắng trang. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[OmniDeck] Render crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center font-sans">
          <div className="text-5xl">🃏</div>
          <h1 className="text-xl font-black">Trang gặp sự cố</h1>
          <p className="text-sm text-gray-400 max-w-md break-words">{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.href = '/dashboard';
            }}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 font-bold"
          >
            Về Navigation Panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
