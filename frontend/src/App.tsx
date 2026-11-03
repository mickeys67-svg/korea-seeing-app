import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-display selection:bg-indigo-500/40 selection:text-white">
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </div>
  );
}

export default App;
