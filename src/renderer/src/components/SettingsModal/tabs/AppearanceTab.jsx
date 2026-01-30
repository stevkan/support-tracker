import { useState, useEffect } from 'react';
import { useApp } from '../../../state';
import { updateSettings } from '../../../api/client';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Use system settings' },
];

export default function AppearanceTab() {
  const { settings, setTheme: applyTheme, refreshSettings, setHasUnsavedChanges } = useApp();

  const [theme, setTheme] = useState('system');
  const [original, setOriginal] = useState('system');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const value = settings?.theme || 'system';
    setTheme(value);
    setOriginal(value);
  }, [settings]);

  function handleThemeChange(value) {
    setTheme(value);
    setHasUnsavedChanges(value !== original);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({ theme });
      applyTheme(theme);
      setOriginal(theme);
      setHasUnsavedChanges(false);
      await refreshSettings();
    } catch (err) {
      console.error('Failed to save theme:', err);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = theme !== original;

  return (
    <div className="appearance-tab">
      <h3 className="appearance-section-title">Theme</h3>
      <div className="radio-group">
        {THEME_OPTIONS.map((option) => (
          <label key={option.value} className="radio-option">
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onChange={(e) => handleThemeChange(e.target.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <div className="appearance-actions">
        <button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
