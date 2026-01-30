import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings, getSecret } from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState(null);
  const [theme, setThemeState] = useState('system');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const applyTheme = useCallback((newTheme) => {
    if (newTheme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = newTheme;
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSettings();
      setSettings(data);
      const loadedTheme = data.theme || 'system';
      setThemeState(loadedTheme);
      applyTheme(loadedTheme);

      // Load username from secrets
      try {
        const secretData = await getSecret('azure-devops-username');
        if (secretData.hasValue && secretData.value) {
          setUsername(secretData.value);
        }
      } catch {
        // Ignore secret fetch errors
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [applyTheme]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const refreshSettings = useCallback(() => {
    return loadSettings();
  }, [loadSettings]);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  const value = {
    settings,
    isLoading,
    error,
    username,
    theme,
    hasUnsavedChanges,
    refreshSettings,
    setTheme,
    setHasUnsavedChanges,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === null) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
