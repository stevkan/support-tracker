import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './state';
import './styles/base.css';
import TopBar from './components/TopBar/TopBar';
import Landing from './pages/Landing/Landing';
import SettingsModal from './components/SettingsModal/SettingsModal';
import PatAlertBanner from './components/PatAlertBanner/PatAlertBanner';

function AppContent() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { hasUnsavedChanges } = useApp();

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (window.electronAPI?.onVerboseLog) {
      const cleanup = window.electronAPI.onVerboseLog((data) => {
        console.log(`[Verbose:${data.source}]`, data.message);
      });
      return cleanup;
    }
  }, []);

  return (
    <div className="app">
      <PatAlertBanner onSettingsClick={() => setSettingsOpen(true)} />
      <TopBar onSettingsClick={() => setSettingsOpen(true)} />
      <main className="main-content">
        <Landing />
      </main>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
