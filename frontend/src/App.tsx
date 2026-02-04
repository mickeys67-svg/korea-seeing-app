import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import DonationPage from './components/DonationPage';

function App() {
  const [view, setView] = useState<'dashboard' | 'donation'>('donation'); // Default to donation for testing

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-blue-500 selection:text-white">
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setView('dashboard')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${view === 'dashboard' ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setView('donation')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${view === 'donation' ? 'bg-purple-600 border-purple-500' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
        >
          Donation
        </button>
      </div>

      {view === 'dashboard' ? <Dashboard /> : <DonationPage />}
    </div>
  );
}

export default App;

