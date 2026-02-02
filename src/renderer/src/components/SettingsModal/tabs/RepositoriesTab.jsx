import { useState, useEffect } from 'react';
import { useApp } from '../../../state';
import { updateSettings } from '../../../api/client';

const GROUPS = [
  { id: 'github', label: 'GitHub' },
  { id: 'stackOverflow', label: 'Stack Overflow' },
  { id: 'internalStackOverflow', label: 'Internal Stack Overflow' },
];

const DEFAULT_REPOSITORIES = {
  github: [
    { org: 'Microsoft', repo: 'botbuilder-azure', enabled: false },
    { org: 'Microsoft', repo: 'botbuilder-cognitiveservices', enabled: false },
    { org: 'Microsoft', repo: 'botbuilder-dotnet', enabled: false },
    { org: 'Microsoft', repo: 'botbuilder-java', enabled: false },
    { org: 'Microsoft', repo: 'botbuilder-js', enabled: false },
    { org: 'Microsoft', repo: 'botbuilder-python', enabled: false },
    { org: 'Microsoft', repo: 'botbuilder-samples', enabled: false },
    { org: 'Microsoft', repo: 'agents', enabled: true },
    { org: 'Microsoft', repo: 'agents-for-net', enabled: true },
    { org: 'Microsoft', repo: 'agents-for-js', enabled: true },
    { org: 'Microsoft', repo: 'agents-for-python', enabled: true },
    { org: 'Microsoft', repo: 'botbuilder-tools', enabled: false },
    { org: 'Microsoft', repo: 'botbuilder-v3', enabled: false },
    { org: 'Microsoft', repo: 'botframework-cli', enabled: false },
    { org: 'Microsoft', repo: 'botframework-composer', enabled: false },
    { org: 'Microsoft', repo: 'botframework-emulator', enabled: false },
    { org: 'Microsoft', repo: 'botframework-directlinejs', enabled: false },
    { org: 'Microsoft', repo: 'botframework-solutions', enabled: false, labels: ['support'] },
    { org: 'Microsoft', repo: 'botframework-services', enabled: false },
    { org: 'Microsoft', repo: 'botframework-sdk', enabled: false, ignoreLabels: ['TeamsSDK'] },
    { org: 'Microsoft', repo: 'botframework-webchat', enabled: false },
    { org: 'MicrosoftDocs', repo: 'bot-docs', enabled: false, labels: ['team: support'] },
  ],
  stackOverflow: [
    { tag: 'adaptive-cards', enabled: true },
    { tag: 'azure-bot-service', enabled: true },
    { tag: 'botframework', enabled: true },
    { tag: 'direct-line-botframework', enabled: true },
    { tag: 'luis', enabled: false },
    { tag: 'azure-language-understanding', enabled: true },
    { tag: 'qnamaker', enabled: false },
    { tag: 'web-chat', enabled: true },
    { tag: 'microsoft-agent', enabled: true },
    { tag: 'teams-ai', enabled: true },
    { tag: 'azure-agent', enabled: true },
    { tag: 'microsoft-copilot', enabled: true },
    { tag: 'copilot-for-m365', enabled: true },
    { tag: 'teams-toolkit', enabled: true },
  ],
  internalStackOverflow: [
    { tag: 'azure-bot-service', enabled: true },
    { tag: 'bot', enabled: true },
    { tag: 'bot-framework', enabled: true },
    { tag: 'luis.ai', enabled: true },
  ],
};

export default function RepositoriesTab() {
  const { settings: appSettings, refreshSettings, setHasUnsavedChanges } = useApp();

  const [activeGroup, setActiveGroup] = useState('github');
  const [formData, setFormData] = useState({
    github: [],
    stackOverflow: [],
    internalStackOverflow: [],
  });
  const [originalData, setOriginalData] = useState({
    github: [],
    stackOverflow: [],
    internalStackOverflow: [],
  });
  const [saving, setSaving] = useState(false);
  const [pendingGroupSwitch, setPendingGroupSwitch] = useState(null);
  const [newItemInput, setNewItemInput] = useState('');

  useEffect(() => {
    loadData();
  }, [appSettings]);

  function loadData() {
    const repositories = appSettings?.repositories || {};
    const data = {
      github: repositories.github?.length ? [...repositories.github] : [...DEFAULT_REPOSITORIES.github],
      stackOverflow: repositories.stackOverflow?.length ? [...repositories.stackOverflow] : [...DEFAULT_REPOSITORIES.stackOverflow],
      internalStackOverflow: repositories.internalStackOverflow?.length ? [...repositories.internalStackOverflow] : [...DEFAULT_REPOSITORIES.internalStackOverflow],
    };
    setFormData(data);
    setOriginalData(JSON.parse(JSON.stringify(data)));
  }

  function hasGroupChanges(groupId) {
    return JSON.stringify(formData[groupId]) !== JSON.stringify(originalData[groupId]);
  }

  function handleGroupSwitch(newGroupId) {
    if (newGroupId === activeGroup) return;
    if (hasGroupChanges(activeGroup)) {
      setPendingGroupSwitch(newGroupId);
      return;
    }
    setActiveGroup(newGroupId);
    setNewItemInput('');
  }

  function confirmGroupSwitch() {
    if (pendingGroupSwitch) {
      setFormData(JSON.parse(JSON.stringify(originalData)));
      setHasUnsavedChanges(false);
      setActiveGroup(pendingGroupSwitch);
      setPendingGroupSwitch(null);
      setNewItemInput('');
    }
  }

  function cancelGroupSwitch() {
    setPendingGroupSwitch(null);
  }

  function handleToggle(index) {
    setFormData((prev) => {
      const updated = { ...prev };
      updated[activeGroup] = [...prev[activeGroup]];
      updated[activeGroup][index] = {
        ...updated[activeGroup][index],
        enabled: !updated[activeGroup][index].enabled,
      };
      return updated;
    });
    setHasUnsavedChanges(true);
  }

  function handleDelete(index) {
    setFormData((prev) => {
      const updated = { ...prev };
      updated[activeGroup] = prev[activeGroup].filter((_, i) => i !== index);
      return updated;
    });
    setHasUnsavedChanges(true);
  }

  function handleAdd() {
    const input = newItemInput.trim();
    if (!input) return;

    if (activeGroup === 'github') {
      const parts = input.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        alert('Please enter in format: org/repo');
        return;
      }
      const [org, repo] = parts;
      const exists = formData.github.some(
        (item) => item.org.toLowerCase() === org.toLowerCase() && item.repo.toLowerCase() === repo.toLowerCase()
      );
      if (exists) {
        alert('This repository already exists');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        github: [...prev.github, { org, repo, enabled: true }],
      }));
    } else {
      const tag = input;
      const exists = formData[activeGroup].some(
        (item) => item.tag.toLowerCase() === tag.toLowerCase()
      );
      if (exists) {
        alert('This tag already exists');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        [activeGroup]: [...prev[activeGroup], { tag, enabled: true }],
      }));
    }

    setNewItemInput('');
    setHasUnsavedChanges(true);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        repositories: {
          ...appSettings?.repositories,
          [activeGroup]: formData[activeGroup],
        },
      });
      await refreshSettings();
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to save repositories:', err);
    } finally {
      setSaving(false);
    }
  }

  function renderGitHubItem(item, index) {
    const displayName = `${item.org}/${item.repo}`;
    const extras = [];
    if (item.labels?.length) extras.push(`labels: ${item.labels.join(', ')}`);
    if (item.ignoreLabels?.length) extras.push(`ignore: ${item.ignoreLabels.join(', ')}`);

    return (
      <div key={`${item.org}/${item.repo}`} className="repo-item">
        <label className="repo-checkbox">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={() => handleToggle(index)}
          />
          <span className="repo-name">{displayName}</span>
          {extras.length > 0 && <span className="repo-extras">({extras.join('; ')})</span>}
        </label>
        <button
          type="button"
          className="btn-icon btn-delete"
          onClick={() => handleDelete(index)}
          aria-label="Delete"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    );
  }

  function renderTagItem(item, index) {
    return (
      <div key={item.tag} className="repo-item">
        <label className="repo-checkbox">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={() => handleToggle(index)}
          />
          <span className="repo-name">{item.tag}</span>
        </label>
        <button
          type="button"
          className="btn-icon btn-delete"
          onClick={() => handleDelete(index)}
          aria-label="Delete"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    );
  }

  const currentGroup = GROUPS.find((g) => g.id === activeGroup);
  const items = formData[activeGroup] || [];
  const isGitHub = activeGroup === 'github';

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
        
        <div className="repo-add-form">
          <input
            type="text"
            value={newItemInput}
            onChange={(e) => setNewItemInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGitHub ? 'org/repo' : 'tag-name'}
            className="repo-add-input"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleAdd}
            disabled={!newItemInput.trim()}
          >
            Add
          </button>
        </div>

        <div className="repo-list">
          {items.map((item, index) =>
            isGitHub ? renderGitHubItem(item, index) : renderTagItem(item, index)
          )}
        </div>

        <div className="settings-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!hasGroupChanges(activeGroup) || saving}
          >
            {saving ? 'Saving...' : 'Save'}
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
