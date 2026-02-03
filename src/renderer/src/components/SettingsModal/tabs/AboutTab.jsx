import { APP_VERSION } from '../../../version';
import './AboutTab.css';

export default function AboutTab() {
  return (
    <div className="about-tab">
      <h3 className="about-section-title">Support Tracker</h3>
      <div className="about-info">
        <div className="about-row">
          <span className="about-label">Version</span>
          <span className="about-value">{APP_VERSION}</span>
        </div>
        <div className="about-row">
          <span className="about-label">Author</span>
          <span className="about-value">Steven Kanberg</span>
        </div>
        <div className="about-row">
          <span className="about-label">Repository</span>
          <a
            className="about-link"
            href="https://github.com/stevkan/support-tracker"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/stevkan/support-tracker
          </a>
        </div>
      </div>
      <div className="about-description">
        <p>
          A desktop app for querying GitHub, Stack Overflow, and Internal Stack Overflow 
          for issues and creating Azure DevOps work items.
        </p>
      </div>
    </div>
  );
}
