import { useState } from 'react';
import { useApp } from '../../state';
import './PatAlertBanner.css';

export default function PatAlertBanner({ onSettingsClick }) {
  const { patStatus } = useApp();
  const [dismissed, setDismissed] = useState(false);

  if (!patStatus.checked || patStatus.valid || dismissed) {
    return null;
  }

  return (
    <div className="pat-alert-banner">
      <div className="pat-alert-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          <strong>Azure DevOps PAT issue:</strong> {patStatus.error || 'Your Personal Access Token may be invalid or expired.'}
        </span>
        <button className="pat-alert-action" onClick={onSettingsClick}>
          Update in Settings
        </button>
        <button className="pat-alert-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
