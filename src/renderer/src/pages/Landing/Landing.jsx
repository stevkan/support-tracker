import { useState, useEffect, useRef, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { useApp } from '../../state';
import { startQuery, getQueryStatus, cancelQuery, updateSettings } from '../../api/client';
import { Results } from '../../components/Results/Results';
import MissingFieldsIndicator from '../../components/MissingFieldsIndicator';
import './Landing.css';

function formatLastRun(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function Landing() {
  const { settings, refreshSettings, isLoading: settingsLoading, configValidation } = useApp();

  const [isRunning, setIsRunning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const [enabledServices, setEnabledServices] = useState({
    github: true,
    stackOverflow: true,
    internalStackOverflow: false,
  });
  const [daysToQuery, setDaysToQuery] = useState('1');
  const [startHour, setStartHour] = useState('10');
  const [pushToDevOps, setPushToDevOps] = useState(true);

  const pollingRef = useRef(null);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (settings && !initializedRef.current) {
      if (settings.enabledServices) {
        setEnabledServices({
          github: settings.enabledServices.github ?? true,
          stackOverflow: settings.enabledServices.stackOverflow ?? true,
          internalStackOverflow: settings.enabledServices.internalStackOverflow ?? false,
        });
      }
      if (settings.queryDefaults?.numberOfDaysToQuery !== undefined) {
        setDaysToQuery(String(settings.queryDefaults.numberOfDaysToQuery));
      }
      if (settings.queryDefaults?.startHour !== undefined) {
        setStartHour(String(settings.queryDefaults.startHour));
      }
      if (settings.pushToDevOps !== undefined) {
        setPushToDevOps(settings.pushToDevOps);
      }
      initializedRef.current = true;
    }
  }, [settings]);

  const persistServiceOptions = useCallback(async (services, days, hour, pushDevOps) => {
    try {
      await updateSettings({
        enabledServices: services,
        pushToDevOps: pushDevOps,
        queryDefaults: {
          numberOfDaysToQuery: parseInt(days, 10) || 1,
          startHour: parseInt(hour, 10) || 10,
        },
      });
    } catch (err) {
      console.error('Failed to save service options:', err);
    }
  }, []);

  const handleServiceToggle = (service) => {
    const updated = { ...enabledServices, [service]: !enabledServices[service] };
    setEnabledServices(updated);
    persistServiceOptions(updated, daysToQuery, startHour, pushToDevOps);
  };

  const handleDaysChange = (value) => {
    setDaysToQuery(value);
    persistServiceOptions(enabledServices, value, startHour, pushToDevOps);
  };

  const handleStartHourChange = (value) => {
    setStartHour(value);
    persistServiceOptions(enabledServices, daysToQuery, value, pushToDevOps);
  };

  const handlePushToDevOpsToggle = () => {
    const updated = !pushToDevOps;
    setPushToDevOps(updated);
    persistServiceOptions(enabledServices, daysToQuery, startHour, updated);
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const pollJobStatus = async (jobId) => {
    try {
      const status = await getQueryStatus(jobId);
      setProgress(status.progress);

      if (status.status === 'completed') {
        setIsRunning(false);

        let issueResults = status.result?.issues || null;
        const services = status.result?.services || {};

        if (issueResults?.index) {
          for (const [key, value] of Object.entries(services)) {
            if (value?.status === 'error') {
              issueResults.index[key] = value;
            }
          }
        }

        setResults(issueResults);
        setCurrentJobId(null);
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        refreshSettings();

        const serviceErrors = status.result?.serviceErrors;
        if (serviceErrors && serviceErrors.length > 0) {
          const errorMessages = serviceErrors
            .map(e => `${e.service}: ${e.message}`)
            .join('\n');
          setError(errorMessages);
        }
      } else if (status.status === 'error') {
        setIsRunning(false);
        setError(status.error || 'An error occurred');
        setCurrentJobId(null);
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      } else if (status.status === 'cancelled') {
        setIsRunning(false);
        setCurrentJobId(null);
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch (err) {
      console.error('Failed to poll job status:', err);
    }
  };

  const handleRunTracker = async () => {
    if (isRunning) {
      if (currentJobId) {
        try {
          await cancelQuery(currentJobId);
        } catch (err) {
          console.error('Failed to cancel query:', err);
        }
      }
      setIsRunning(false);
      setCurrentJobId(null);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } else {
      setIsRunning(true);
      setResults(null);
      setError(null);
      setProgress(null);

      try {
        const { jobId } = await startQuery(enabledServices, {
          numberOfDaysToQuery: parseInt(daysToQuery, 10) || 1,
          startHour: parseInt(startHour, 10) || 10,
          pushToDevOps,
        });
        setCurrentJobId(jobId);

        pollingRef.current = setInterval(() => {
          pollJobStatus(jobId);
        }, 1000);
      } catch (err) {
        setError(err.message || 'Failed to start query');
        setIsRunning(false);
      }
    }
  };

  const lastRunTimestamp = settings?.timestamp?.lastRun;

  const isConfigValid = (() => {
    if (!configValidation.isValid) return false;
    
    const repositories = settings?.repositories || {};
    
    if (enabledServices.github) {
      const githubRepos = repositories.github || [];
      if (!githubRepos.some((r) => r.enabled)) return false;
    }
    
    if (enabledServices.stackOverflow) {
      const soTags = repositories.stackOverflow || [];
      if (!soTags.some((t) => t.enabled)) return false;
    }
    
    if (enabledServices.internalStackOverflow) {
      const internalTags = repositories.internalStackOverflow || [];
      if (!internalTags.some((t) => t.enabled)) return false;
    }
    
    return true;
  })();

  const handleExportResults = () => {
    if (!results || !results.index) return;

    const doc = new jsPDF();
    const { startTime, endTime, stackOverflow, internalStackOverflow, github } = results.index;
    let yPos = 20;
    const lineHeight = 7;
    const pageHeight = 280;

    const addText = (text, fontSize = 12, isBold = false) => {
      if (yPos > pageHeight) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.text(text, 14, yPos);
      yPos += lineHeight;
    };

    const addServiceSection = (name, data, showRepo = false) => {
      if (!data) return;
      addText(name, 14, true);
      yPos += 3;

      const { found, devOps, newIssues } = data;

      if (found.count === 0) {
        addText('No Issues Discovered');
      } else {
        addText(`Issues Discovered: ${found.count}`);
        found.issues?.forEach((issue) => {
          const repo = showRepo && issue['Custom.Repository'] ? `[${issue['Custom.Repository']}] ` : '';
          const title = issue['System.Title'] || '';
          const truncatedTitle = title.length > 80 ? title.substring(0, 80) + '...' : title;
          addText(`  • ${issue['Custom.IssueID']}: ${repo}${truncatedTitle}`, 10);
        });

        yPos += 3;
        addText('Possible Matching DevOps Issues:', 11, true);
        if (devOps && devOps.length > 0) {
          devOps.forEach((issue) => {
            const title = issue['System.Title'] || '';
            const truncatedTitle = title.length > 70 ? title.substring(0, 70) + '...' : title;
            addText(`  • ${issue.id}: ${truncatedTitle}`, 10);
          });
        } else {
          addText('  No Matching Issues Exist', 10);
        }

        yPos += 3;
        if (newIssues && newIssues.count > 0) {
          addText(`New Issues: ${newIssues.count}`, 11, true);
          newIssues.issues?.forEach((issue) => {
            const title = issue['System.Title'] || '';
            const truncatedTitle = title.length > 70 ? title.substring(0, 70) + '...' : title;
            addText(`  • ${issue.id}: ${truncatedTitle}`, 10);
          });
        } else {
          addText('No New Issues To Add', 10);
        }
      }
      yPos += 8;
    };

    addText('Support Tracker Results', 18, true);
    yPos += 5;
    addText(`Starting Processes: ${startTime}`);
    addText(`Finished Processes: ${endTime}`);
    yPos += 8;

    addServiceSection('Stack Overflow', stackOverflow);
    addServiceSection('Internal Stack Overflow', internalStackOverflow);
    addServiceSection('GitHub', github, true);

    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`support-tracker-results-${timestamp}.pdf`);
  };

  if (settingsLoading) {
    return (
      <div className="landing">
        <div className="landing-loading">
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <h1 className="landing-title">Support Tracker</h1>
      <p className="landing-last-run">Last run: {formatLastRun(lastRunTimestamp)}</p>

      <div className="service-options">
        <h2 className="service-options-title">Service Options</h2>

        <div className="service-checkboxes">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabledServices.github}
              onChange={() => handleServiceToggle('github')}
              disabled={isRunning}
            />
            <span>GitHub</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabledServices.stackOverflow}
              onChange={() => handleServiceToggle('stackOverflow')}
              disabled={isRunning}
            />
            <span>Stack Overflow</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabledServices.internalStackOverflow}
              onChange={() => handleServiceToggle('internalStackOverflow')}
              disabled={isRunning}
            />
            <span>Internal Stack Overflow</span>
          </label>
        </div>

        <div className="devops-toggle-row">
          <div className="toggle-group">
            <span className="toggle-label">Push new issues to Azure DevOps</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={pushToDevOps}
                onChange={handlePushToDevOpsToggle}
                disabled={isRunning}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="service-inputs">
          <div className="input-group">
            <label htmlFor="daysToQuery">Number of Days to Query</label>
            <input
              id="daysToQuery"
              type="number"
              min="1"
              max="365"
              value={daysToQuery}
              onChange={(e) => setDaysToQuery(e.target.value)}
              onBlur={(e) => {
                let val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 1) val = 1;
                else if (val > 365) val = 365;
                handleDaysChange(String(val));
              }}
              disabled={isRunning}
            />
          </div>
          <div className="input-group">
            <label htmlFor="startHour">Start Hour of Query (0-23)</label>
            <input
              id="startHour"
              type="number"
              min="0"
              max="23"
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              onBlur={(e) => {
                let val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 0) val = 0;
                else if (val > 23) val = 23;
                handleStartHourChange(String(val));
              }}
              disabled={isRunning}
            />
          </div>
        </div>
      </div>

      <div className="action-section">
        <button
          className={`run-button ${isRunning ? 'stop' : 'start'}${!isConfigValid && !isRunning ? ' disabled' : ''}`}
          onClick={handleRunTracker}
          disabled={!isConfigValid && !isRunning}
        >
          {isRunning ? 'Stop Tracker' : 'Run Tracker'}
        </button>
        {results && results.index && (
          <button
            className="export-button"
            onClick={handleExportResults}
          >
            Export Results
          </button>
        )}
      </div>

      {!isConfigValid && !isRunning && (
        <MissingFieldsIndicator groupedErrors={configValidation.groupedErrors} />
      )}

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      <Results results={results} isLoading={isRunning} progress={progress} />
    </div>
  );
}

export default Landing;
