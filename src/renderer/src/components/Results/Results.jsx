import { useState, useEffect } from 'react';
import './Results.css';

function formatElapsedTime(startTime) {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function IssueTable({ issues, showDevOpsId = false, showRepo = false }) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="results-table">
      <div className="results-row table-header">
        {showDevOpsId && <div className="header-cell id">DevOps Id:</div>}
        <div className="header-cell id">Issue Id:</div>
        {showRepo && <div className="header-cell repo">Repo:</div>}
        <div className="header-cell title">Issue Title:</div>
      </div>
      {issues.map((issue, index) => (
        <div className="results-row" key={index}>
          {showDevOpsId && (
            <div className="results-cell id">
              {issue['Custom.DevOpsURL'] ? (
                <a href={issue['Custom.DevOpsURL']} target="_blank" rel="noopener noreferrer" title={issue['Custom.DevOpsURL']}>
                  {issue.id}
                </a>
              ) : (
                issue.id ?? '—'
              )}
            </div>
          )}
          <div className="results-cell id">
            <a href={issue['Custom.IssueURL']} target="_blank" rel="noopener noreferrer" title={issue['Custom.IssueURL']}>
              {issue['Custom.IssueID']}
            </a>
          </div>
          {showRepo && <div className="results-cell repo">{issue['Custom.Repository']}</div>}
          <div className="results-cell title">{issue['System.Title']}</div>
        </div>
      ))}
    </div>
  );
}

function ServiceSection({ name, data, className, showRepo = false }) {
  if (!data) return null;

  const { found, devOps, newIssues } = data;

  return (
    <div className={`results-service ${className}`}>
      <h2>{name}</h2>
      {found.count === 0 ? (
        <p>No Issues Discovered</p>
      ) : (
        <>
          <p>Issues Discovered: {found.count}</p>
          <IssueTable issues={found.issues} showRepo={showRepo} />
          
          <p className="subsection-header">Possible Matching DevOps Issues:</p>
          {devOps && devOps.length > 0 ? (
            <IssueTable issues={devOps} showDevOpsId showRepo={showRepo} />
          ) : (
            <p>No Matching Issues Exist</p>
          )}
          
          {newIssues && newIssues.count > 0 ? (
            <>
              <p>New Issues: {newIssues.count}</p>
              <IssueTable issues={newIssues.issues} showDevOpsId showRepo={showRepo} />
            </>
          ) : (
            <p>No New Issues To Add</p>
          )}
        </>
      )}
    </div>
  );
}

export function Results({ results, isLoading, progress }) {
  const [elapsedTime, setElapsedTime] = useState('0:00');
  const [loadingStart, setLoadingStart] = useState(null);

  useEffect(() => {
    if (isLoading) {
      const start = Date.now();
      setLoadingStart(start);
      setElapsedTime('0:00');

      const interval = setInterval(() => {
        setElapsedTime(formatElapsedTime(start));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="results-container">
        <div className="results-loading">
          <p className="loading-title">Querying services...</p>
          <p className="loading-elapsed">Elapsed time: {elapsedTime}</p>
          {progress?.currentService && (
            <p className="loading-service">Current service: {progress.currentService}</p>
          )}
        </div>
      </div>
    );
  }

  if (!results || !results.index) {
    return (
      <div className="results-container">
        <div className="results-empty">
          <p>No results to display. Run a query to see results.</p>
        </div>
      </div>
    );
  }

  const { startTime, endTime, stackOverflow, internalStackOverflow, github } = results.index;

  return (
    <div className="results-container">
      <div className="results-process-time process-start">
        Starting Processes: {startTime}
      </div>

      <ServiceSection
        name="Stack Overflow"
        data={stackOverflow}
        className="stackoverflow"
      />

      <ServiceSection
        name="Internal Stack Overflow"
        data={internalStackOverflow}
        className="internal-stackoverflow"
      />

      <ServiceSection
        name="GitHub"
        data={github}
        className="github"
        showRepo
      />

      <div className="results-process-time process-end">
        Finished Processes: {endTime}
      </div>
    </div>
  );
}
