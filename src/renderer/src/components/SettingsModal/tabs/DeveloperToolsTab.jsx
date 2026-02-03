import './DeveloperToolsTab.css';

export default function DeveloperToolsTab() {
  const handleReload = () => {
    window.electronAPI.reload();
  };

  const handleForceReload = () => {
    window.electronAPI.forceReload();
  };

  const handleToggleDevTools = () => {
    window.electronAPI.toggleDevTools();
  };

  return (
    <div className="developer-tools-tab">
      <h3 className="developer-tools-section-title">Window Actions</h3>
      <div className="developer-tools-buttons">
        <button className="dev-tools-btn" onClick={handleReload}>
          Reload
        </button>
        <button className="dev-tools-btn" onClick={handleForceReload}>
          Force Reload
        </button>
        <button className="dev-tools-btn" onClick={handleToggleDevTools}>
          Toggle Developer Tools
        </button>
      </div>
    </div>
  );
}
