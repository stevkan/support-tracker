import { useState } from 'react';
import { useApp } from '../../state';
import Modal from '../Modal/Modal';
import SettingsTab from './tabs/SettingsTab';
import AppearanceTab from './tabs/AppearanceTab';
import RepositoriesTab from './tabs/RepositoriesTab';
import DeveloperToolsTab from './tabs/DeveloperToolsTab';
import AboutTab from './tabs/AboutTab';
import './SettingsModal.css';

const TABS = [
  { id: 'settings', label: 'Settings' },
  { id: 'repositories', label: 'Repositories' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'devtools', label: 'Developer Tools' },
  { id: 'about', label: 'About' },
];

export default function SettingsModal({ isOpen, onClose }) {
  const { hasUnsavedChanges, setHasUnsavedChanges } = useApp();
  const [activeTab, setActiveTab] = useState('settings');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  };

  const confirmClose = () => {
    setHasUnsavedChanges(false);
    setShowCloseConfirm(false);
    onClose();
  };

  const cancelClose = () => {
    setShowCloseConfirm(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Options">
      <div className="settings-modal">
        <div className="settings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="settings-tab-content">
          {activeTab === 'settings' && <SettingsTab onNavigateTab={setActiveTab} />}
          {activeTab === 'repositories' && <RepositoriesTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'devtools' && <DeveloperToolsTab />}
          {activeTab === 'about' && <AboutTab />}
        </div>
        {showCloseConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <p>You have unsaved changes. Discard and close?</p>
              <div className="confirm-actions">
                <button className="btn-secondary" onClick={cancelClose}>Cancel</button>
                <button className="btn-primary" onClick={confirmClose}>Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
