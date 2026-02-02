import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings, getSecret, checkSecrets } from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState(null);
  const [theme, setThemeState] = useState('system');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [configValidation, setConfigValidation] = useState({ isValid: false, errors: [], groupedErrors: {} });

  const applyTheme = useCallback((newTheme) => {
    if (newTheme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = newTheme;
    }
  }, []);

  const validateConfiguration = useCallback(async (data) => {
    const errors = [];
    const groupedErrors = {};
    const enabledServices = data?.enabledServices || {};

    const addError = (group, message) => {
      errors.push(message);
      if (!groupedErrors[group]) {
        groupedErrors[group] = [];
      }
      groupedErrors[group].push(message);
    };

    // Check Azure DevOps settings (always required)
    const ado = data?.azureDevOps || {};
    if (!ado.org || ado.org.trim() === '') {
      addError('Azure DevOps', 'Organization is required');
    }
    if (!ado.project || ado.project.trim() === '') {
      addError('Azure DevOps', 'Project is required');
    }
    if (!ado.apiVersion || ado.apiVersion.trim() === '') {
      addError('Azure DevOps', 'API Version is required');
    }

    // Check required secrets
    try {
      const secretKeys = [
        'azure-devops-username',
        'azure-devops-pat',
        'github-token',
        'stack-overflow-key',
        'appinsights-key',
      ];
      const secretStatus = await checkSecrets(secretKeys);

      if (!secretStatus['azure-devops-username']) {
        addError('API Keys', 'Azure DevOps Username is required');
      }
      if (!secretStatus['azure-devops-pat']) {
        addError('API Keys', 'Azure DevOps Personal Access Token is required');
      }
      if (!secretStatus['github-token']) {
        addError('API Keys', 'GitHub Token is required');
      }
      if (!secretStatus['stack-overflow-key']) {
        addError('API Keys', 'Stack Overflow Enterprise Key is required');
      }
      if (!secretStatus['appinsights-key']) {
        addError('API Keys', 'App Insights Instrumentation Key is required');
      }
    } catch (err) {
      console.error('Failed to check secrets:', err);
      addError('API Keys', 'Unable to verify API keys');
    }

    // Check repositories for enabled services
    const repositories = data?.repositories || {};

    if (enabledServices.github) {
      const githubRepos = repositories.github || [];
      const hasEnabledRepo = githubRepos.some((r) => r.enabled);
      if (!hasEnabledRepo) {
        addError('GitHub', 'At least one repository must be selected');
      }
    }

    if (enabledServices.stackOverflow) {
      const soTags = repositories.stackOverflow || [];
      const hasEnabledTag = soTags.some((t) => t.enabled);
      if (!hasEnabledTag) {
        addError('Stack Overflow', 'At least one tag must be selected');
      }
    }

    if (enabledServices.internalStackOverflow) {
      const internalTags = repositories.internalStackOverflow || [];
      const hasEnabledTag = internalTags.some((t) => t.enabled);
      if (!hasEnabledTag) {
        addError('Internal Stack Overflow', 'At least one tag must be selected');
      }
    }

    setConfigValidation({ isValid: errors.length === 0, errors, groupedErrors });
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

      // Load username from secrets and validate configuration
      try {
        const secretData = await getSecret('azure-devops-username');
        if (secretData.hasValue && secretData.value) {
          setUsername(secretData.value);
        }
      } catch {
        // Ignore secret fetch errors
      }

      // Validate configuration for Run Tracker button
      await validateConfiguration(data);
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
    configValidation,
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
