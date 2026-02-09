import { useState, useEffect } from 'react';
import { useApp } from '../../../state';
import { updateSettings, setSecret, checkSecret, getSecret, deleteSecret, validateAzureDevOpsPat, validateGitHubToken, validateStackOverflowKey } from '../../../api/client';

const GROUPS = [
  { id: 'azureDevOps', label: 'Azure DevOps' },
  { id: 'apiKeys', label: 'API Keys' },
  { id: 'advanced', label: 'Advanced' },
];

const SECRET_KEY_MAP = {
  adoUsername: 'azure-devops-username',
  adoPat: 'azure-devops-pat',
  githubToken: 'github-token',
  stackOverflowKey: 'stack-overflow-key',
  appInsightsKey: 'appinsights-key',
};

export default function SettingsTab({ onNavigateTab }) {
  const { settings: appSettings, refreshSettings, setHasUnsavedChanges, recheckPatStatus } = useApp();

  const [activeGroup, setActiveGroup] = useState('azureDevOps');
  const [formData, setFormData] = useState({
    adoOrg: '',
    adoProject: '',
    adoApiVersion: '6.1',
    adoUsername: '',
    adoPat: '',
    githubToken: '',
    stackOverflowKey: '',
    appInsightsKey: '',
    useTestData: false,
    isVerbose: false,
  });
  const [originalData, setOriginalData] = useState({});
  const [secretStatus, setSecretStatus] = useState({});
  const [saving, setSaving] = useState(false);
  const [visibleFields, setVisibleFields] = useState({});
  const [loadedSecrets, setLoadedSecrets] = useState({});
  const [pendingGroupSwitch, setPendingGroupSwitch] = useState(null);
  const [validationStatus, setValidationStatus] = useState({ status: null, message: '' });
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    loadData();
  }, [appSettings]);

  async function loadData() {
    const data = {
      adoOrg: appSettings?.azureDevOps?.org || '',
      adoProject: appSettings?.azureDevOps?.project || '',
      adoApiVersion: appSettings?.azureDevOps?.apiVersion || '',
      adoUsername: '',
      adoPat: '',
      githubToken: '',
      stackOverflowKey: '',
      appInsightsKey: '',
      useTestData: appSettings?.useTestData || false,
      isVerbose: appSettings?.isVerbose || false,
    };

    setFormData(data);
    setOriginalData({ ...data });

    const statuses = {};
    for (const [fieldKey, secretKey] of Object.entries(SECRET_KEY_MAP)) {
      try {
        const result = await checkSecret(secretKey);
        statuses[fieldKey] = result.hasValue;
      } catch {
        statuses[fieldKey] = false;
      }
    }
    setSecretStatus(statuses);
  }

  function handleChange(key, value) {
    const newFormData = { ...formData, [key]: value };
    setFormData(newFormData);

    const fields = getFieldsForGroup(activeGroup);
    const hasChanges = fields.some((f) => {
      const fieldKey = f.key;
      const currentValue = newFormData[fieldKey] || '';

      if (SECRET_KEY_MAP[fieldKey]) {
        if (fieldKey in loadedSecrets) {
          return currentValue !== loadedSecrets[fieldKey];
        }
        return currentValue !== '';
      }
      return newFormData[fieldKey] !== originalData[fieldKey];
    });

    setHasUnsavedChanges(hasChanges);
  }

  async function toggleVisibility(key) {
    const isCurrentlyVisible = visibleFields[key];
    
    if (!isCurrentlyVisible && secretStatus[key] && !formData[key]) {
      // Fetch the stored secret value to display it
      const secretKey = SECRET_KEY_MAP[key];
      if (secretKey) {
        try {
          const result = await getSecret(secretKey);
          if (result.value) {
            setFormData((prev) => ({ ...prev, [key]: result.value }));
            setLoadedSecrets((prev) => ({ ...prev, [key]: result.value }));
          }
        } catch (err) {
          console.error('Failed to fetch secret:', err);
        }
      }
    }
    
    setVisibleFields((prev) => ({ ...prev, [key]: !isCurrentlyVisible }));
  }

  function isChanged(key) {
    if (SECRET_KEY_MAP[key]) {
      const currentValue = formData[key] || '';
      // If we've revealed/loaded the secret, any difference (including clearing) is a change
      if (key in loadedSecrets) {
        return currentValue !== loadedSecrets[key];
      }
      // If not revealed yet, only changed if user typed something new
      return currentValue !== '';
    }
    return formData[key] !== originalData[key];
  }

  function hasGroupChanges(groupId) {
    const fields = getFieldsForGroup(groupId);
    return fields.some((f) => isChanged(f.key));
  }

  function handleGroupSwitch(newGroupId) {
    if (newGroupId === activeGroup) return;
    
    if (hasGroupChanges(activeGroup)) {
      setPendingGroupSwitch(newGroupId);
      return;
    }
    setActiveGroup(newGroupId);
  }

  function confirmGroupSwitch() {
    if (pendingGroupSwitch) {
      setFormData({ ...originalData });
      setLoadedSecrets({});
      setVisibleFields({});
      setHasUnsavedChanges(false);
      setActiveGroup(pendingGroupSwitch);
      setPendingGroupSwitch(null);
    }
  }

  function cancelGroupSwitch() {
    setPendingGroupSwitch(null);
  }

  function getFieldsForGroup(groupId) {
    switch (groupId) {
      case 'azureDevOps':
        return [
          { key: 'adoUsername', label: 'Username', type: 'text', isSecret: true },
          { key: 'adoPat', label: 'Personal Access Token', type: 'password', isSecret: true },
          { key: 'adoOrg', label: 'Organization', type: 'text' },
          { key: 'adoProject', label: 'Project', type: 'text' },
          { key: 'adoApiVersion', label: 'API Version', type: 'text' },
        ];
      case 'apiKeys':
        return [
          { key: 'githubToken', label: 'GitHub Token', type: 'password', isSecret: true },
          { key: 'stackOverflowKey', label: 'Stack Overflow Enterprise Key', type: 'password', isSecret: true },
          { key: 'appInsightsKey', label: 'App Insights Instrumentation Key', type: 'password', isSecret: true },
        ];
      case 'advanced':
        return [
          { key: 'useTestData', label: 'Use Test Data', type: 'toggle', hint: 'testdata' },
          { key: 'isVerbose', label: 'Verbose Logging', type: 'toggle', hint: 'devtools' },
        ];
      default:
        return [];
    }
  }

  async function handleSave() {
    setSaving(true);
    setValidationStatus({ status: null, message: '' });
    
    try {
      const fields = getFieldsForGroup(activeGroup);

      // For Azure DevOps, validate credentials before saving
      if (activeGroup === 'azureDevOps') {
        const patInForm = formData.adoPat && formData.adoPat.trim() !== '';
        const orgInForm = formData.adoOrg && formData.adoOrg.trim() !== '';
        const usernameInForm = formData.adoUsername && formData.adoUsername.trim() !== '';
        
        const patChanged = isChanged('adoPat');
        const orgChanged = isChanged('adoOrg');
        const usernameChanged = isChanged('adoUsername');
        
        // Validate email format for username if it was changed
        if (usernameInForm) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData.adoUsername.trim())) {
            setValidationStatus({ status: 'error', message: 'Username must be a valid email address' });
            setSaving(false);
            return;
          }
        }
        
        // Validate if any credential field has a value in the form and something changed
        if ((patInForm || orgInForm || usernameInForm) && (patChanged || orgChanged || usernameChanged)) {
          setValidating(true);
          setValidationStatus({ status: 'validating', message: 'Validating credentials...' });
          
          // Get the values to validate
          const org = formData.adoOrg || appSettings?.azureDevOps?.org;
          let username = formData.adoUsername;
          let pat = formData.adoPat;
          
          // If username wasn't entered in form but exists in secrets, fetch it
          if (!username && !usernameInForm && secretStatus.adoUsername) {
            try {
              const result = await getSecret('azure-devops-username');
              username = result.value || '';
            } catch (err) {
              console.error('Failed to fetch existing username:', err);
              username = '';
            }
          }
          
          // If PAT wasn't entered in form but exists in secrets, fetch it
          if (!pat && !patInForm && secretStatus.adoPat) {
            try {
              const result = await getSecret('azure-devops-pat');
              pat = result.value;
            } catch (err) {
              console.error('Failed to fetch existing PAT:', err);
            }
          }
          
          if (org && pat) {
            try {
              const apiVersion = formData.adoApiVersion || appSettings?.azureDevOps?.apiVersion;
              const validation = await validateAzureDevOpsPat(org, username || '', pat, apiVersion);
              setValidating(false);
              
              if (!validation.valid) {
                setValidationStatus({ status: 'error', message: validation.error || 'Invalid credentials' });
                setSaving(false);
                return;
              }
              setValidationStatus({ status: 'success', message: 'Credentials validated successfully' });
            } catch (err) {
              setValidating(false);
              setValidationStatus({ status: 'error', message: 'Failed to validate credentials' });
              setSaving(false);
              return;
            }
          }
        }
      }

      // For API Keys, validate GitHub token and Stack Overflow key before saving
      if (activeGroup === 'apiKeys') {
        const githubTokenInForm = formData.githubToken && formData.githubToken.trim() !== '';
        const stackOverflowKeyInForm = formData.stackOverflowKey && formData.stackOverflowKey.trim() !== '';
        
        const githubTokenChanged = isChanged('githubToken');
        const stackOverflowKeyChanged = isChanged('stackOverflowKey');
        
        // Validate GitHub token if changed
        if (githubTokenInForm && githubTokenChanged) {
          setValidating(true);
          setValidationStatus({ status: 'validating', message: 'Validating GitHub token...' });
          
          try {
            const validation = await validateGitHubToken(formData.githubToken);
            setValidating(false);
            
            if (!validation.valid) {
              setValidationStatus({ status: 'error', message: validation.error || 'Invalid GitHub token' });
              setSaving(false);
              return;
            }
            setValidationStatus({ status: 'success', message: 'GitHub token validated' });
          } catch (err) {
            setValidating(false);
            setValidationStatus({ status: 'error', message: 'Failed to validate GitHub token' });
            setSaving(false);
            return;
          }
        }
        
        // Validate Stack Overflow Enterprise key if changed
        if (stackOverflowKeyInForm && stackOverflowKeyChanged) {
          setValidating(true);
          setValidationStatus({ status: 'validating', message: 'Validating Stack Overflow Enterprise key...' });
          
          try {
            const validation = await validateStackOverflowKey(formData.stackOverflowKey);
            setValidating(false);
            
            if (!validation.valid) {
              setValidationStatus({ status: 'error', message: validation.error || 'Invalid Stack Overflow Enterprise key' });
              setSaving(false);
              return;
            }
            setValidationStatus({ status: 'success', message: 'Stack Overflow Enterprise key validated' });
          } catch (err) {
            setValidating(false);
            setValidationStatus({ status: 'error', message: 'Failed to validate Stack Overflow Enterprise key' });
            setSaving(false);
            return;
          }
        }
        
        // If both were validated, show combined success message
        if (githubTokenInForm && githubTokenChanged && stackOverflowKeyInForm && stackOverflowKeyChanged) {
          setValidationStatus({ status: 'success', message: 'API keys validated successfully' });
        }
      }

      for (const field of fields) {
        if (!isChanged(field.key)) continue;

        if (field.isSecret) {
          const secretKey = SECRET_KEY_MAP[field.key];
          if (secretKey) {
            if (formData[field.key]) {
              await setSecret(secretKey, formData[field.key]);
            } else if (field.key in loadedSecrets) {
              await deleteSecret(secretKey);
            }
          }
        }
      }

      if (activeGroup === 'azureDevOps') {
        const azureDevOpsUpdates = {};
        if (isChanged('adoOrg')) azureDevOpsUpdates.org = formData.adoOrg;
        if (isChanged('adoProject')) azureDevOpsUpdates.project = formData.adoProject;
        if (isChanged('adoApiVersion')) azureDevOpsUpdates.apiVersion = formData.adoApiVersion;

        if (Object.keys(azureDevOpsUpdates).length > 0) {
          await updateSettings({
            azureDevOps: { ...appSettings?.azureDevOps, ...azureDevOpsUpdates },
          });
        }
      }

      if (activeGroup === 'advanced') {
        const advancedUpdates = {};
        if (isChanged('useTestData')) advancedUpdates.useTestData = formData.useTestData;
        if (isChanged('isVerbose')) advancedUpdates.isVerbose = formData.isVerbose;

        if (Object.keys(advancedUpdates).length > 0) {
          await updateSettings(advancedUpdates);
        }
      }

      await refreshSettings();
      setVisibleFields({});
      setLoadedSecrets({});
      setHasUnsavedChanges(false);
      
      // Recheck PAT status after saving Azure DevOps settings
      if (activeGroup === 'azureDevOps') {
        await recheckPatStatus();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setValidationStatus({ status: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
      setValidating(false);
    }
  }

  function renderField(field) {
    const value = formData[field.key] ?? '';
    const changed = isChanged(field.key);

    if (field.type === 'toggle') {
      return (
        <div key={field.key} className="toggle-group">
          <span className="toggle-label">
            {field.label}
            {field.hint === 'devtools' && (
              <> (enable <a
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigateTab?.('devtools'); }}
                style={{ color: 'var(--accent-color, #4ea1d3)', textDecoration: 'underline', cursor: 'pointer' }}
              >Developer Tools</a> to view)</>
            )}
            {field.hint === 'testdata' && (
              <> (<a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const result = await window.electronAPI.openTestData();
                    if (result) {
                      setValidationStatus({ status: 'error', message: `Could not open test data file: ${result}` });
                    }
                  } catch (err) {
                    setValidationStatus({ status: 'error', message: 'Failed to open test data file' });
                  }
                }}
                style={{ color: 'var(--accent-color, #4ea1d3)', textDecoration: 'underline', cursor: 'pointer' }}
              >edit test data</a>)</>
            )}
          </span>
          <label className={`toggle-switch ${changed ? 'changed' : ''}`}>
            <input
              type="checkbox"
              checked={!!formData[field.key]}
              onChange={(e) => handleChange(field.key, e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      );
    }

    const isSecretField = field.isSecret;
    const isVisible = visibleFields[field.key];

    return (
      <div key={field.key} className="form-group">
        <label>{field.label}</label>
        <div className={`input-wrapper ${isSecretField ? 'has-toggle' : ''}`}>
          <input
            type={isSecretField && !isVisible ? 'password' : 'text'}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className={changed ? 'changed' : ''}
            placeholder={isSecretField && secretStatus[field.key] ? '••••••••' : ''}
          />
          {isSecretField && (
            <button
              type="button"
              className="visibility-toggle"
              onClick={() => toggleVisibility(field.key)}
              aria-label={isVisible ? 'Hide value' : 'Show value'}
            >
              {isVisible ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentFields = getFieldsForGroup(activeGroup);
  const currentGroup = GROUPS.find((g) => g.id === activeGroup);

  return (
    <div className="settings-layout">
      <div className="settings-sidebar">
        <div className="settings-menu">
          {GROUPS.map((group) => (
            <button
              key={group.id}
              className={`settings-menu-item ${activeGroup === group.id ? 'active' : ''}`}
              onClick={() => handleGroupSwitch(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-content">
        <h3 className="settings-group-title">{currentGroup?.label}</h3>
        {currentFields.map(renderField)}
        {validationStatus.status && (activeGroup === 'azureDevOps' || activeGroup === 'apiKeys' || activeGroup === 'advanced') && (
          <div className={`validation-status validation-${validationStatus.status}`}>
            {validationStatus.status === 'validating' && (
              <span className="validation-spinner"></span>
            )}
            {validationStatus.status === 'success' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            )}
            {validationStatus.status === 'error' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            <span>{validationStatus.message}</span>
          </div>
        )}
        <div className="settings-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!hasGroupChanges(activeGroup) || saving || validating}
          >
            {validating ? 'Validating...' : saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      {pendingGroupSwitch && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p>You have unsaved changes. Discard and switch?</p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={cancelGroupSwitch}>Cancel</button>
              <button className="btn-primary" onClick={confirmGroupSwitch}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
