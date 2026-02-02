import { useState } from 'react';
import './MissingFieldsIndicator.css';

function MissingFieldsIndicator({ groupedErrors }) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const groups = Object.keys(groupedErrors || {});

  if (groups.length === 0) {
    return null;
  }

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  return (
    <div className="missing-fields-indicator">
      {groups.map((group) => {
        const errors = groupedErrors[group];
        const isExpanded = expandedGroups[group];

        return (
          <div key={group} className="missing-fields-group">
            <button
              className="missing-fields-header"
              onClick={() => toggleGroup(group)}
              type="button"
            >
              <span className="missing-fields-arrow">{isExpanded ? '▾' : '▸'}</span>
              <span className="missing-fields-label">
                {group} ({errors.length} missing)
              </span>
            </button>
            {isExpanded && (
              <ul className="missing-fields-list">
                {errors.map((error, index) => (
                  <li key={index} className="missing-fields-item">
                    {error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MissingFieldsIndicator;
