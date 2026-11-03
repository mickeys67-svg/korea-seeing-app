import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * 최상위 에러 경계. 렌더 중 예외가 나면 앱 전체가 백화면이 되는 대신
 * 안내와 새로고침 버튼을 보여 준다. 경계 자체가 깨지지 않도록 의존성 없이
 * (i18n·외부 컴포넌트 import 없이) 작성한다.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // 콘솔에만 남긴다(수집 서버 없음 — 비용 0원 유지).
    console.error('[ErrorBoundary] 렌더 오류:', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
          background: 'var(--bg-void, #0a0a0f)',
          color: 'var(--text-primary, #e8e8f0)',
        }}
      >
        <div style={{ fontSize: '40px', lineHeight: 1 }}>🌙</div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          화면을 그리다 문제가 생겼어요
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.75, margin: 0, maxWidth: '320px' }}>
          일시적인 오류예요. 새로고침하면 대부분 바로 풀립니다.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: '4px',
            padding: '10px 22px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--accent, #6366f1)',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          새로고침
        </button>
        {this.state.message && (
          <p style={{ fontSize: '11px', opacity: 0.4, margin: '8px 0 0', fontFamily: 'monospace' }}>
            {this.state.message}
          </p>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
