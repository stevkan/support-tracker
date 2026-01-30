import fs from 'fs/promises';
import path from 'path';

import { jsonStore } from './store/jsonStore.js';
import { sleep } from './utils.js';

async function generateIndexHtml(jsonData) {
  const indexPath = path.join(process.cwd(), 'index.html');

  // Delete the index.html file located following the `indexPath` path
  try {
    await fs.unlink(indexPath);
  } catch (error) {
    console.error('Failed to delete index.html:', error);
  }

  const {
    startTime,
    endTime,
    stackOverflow,
    internalStackOverflow,
    github
  } = jsonData.index;
  let soContent, isoContent, ghContent;

  const setServiceContentHTML = (serviceContainer, issues) => {
    if (serviceContainer === 'found' && issues.length === 0) return `<p>No Issues Discovered</p>`;
    if (serviceContainer === 'devOps' && issues.length === 0) return `<p>No Matching Issues Exist</p>`;
    if (serviceContainer === 'newIssues' && issues.length === 0) return `<p>No New Issues To Add</p>`;

    let bodyContent, headerContentWithId, headerContentWithoutId, postContentWithId, postContentWithoutId;
    if (serviceContainer === 'devOps') {
      headerContentWithId = `
      <div class="post-table">
        <div class="post-row table-header">
          <div class="header-cell id">DevOps Id:</div>
          <div class="header-cell id">Issue Id:</div>
          <div class="header-cell title">Issue Title:</div>
        </div>`;
    }
    else {
      headerContentWithoutId = `
      <div class="post-table">
        <div class="post-row table-header">
          <div class="header-cell id">Issue Id:</div>
          <div class="header-cell title">Issue Title:</div>
        </div>`;
    }
    const headerContent = headerContentWithId ? headerContentWithId : headerContentWithoutId;
    const footerContent = `
      </div>`;
    for (const issue of issues) {
      if (serviceContainer === 'devOps') {
        postContentWithId = `
          <div class="post-row">
            <div class="post-cell id">${issue['id']}</div>
            <div class="post-cell id">
              <a href='${issue['Custom.IssueURL']}' title='${issue['Custom.IssueURL']}' target='_blank'>${issue['Custom.IssueID']}</a>
            </div>
            <div class="post-cell title">${issue['System.Title']}</div>
          </div>
        `;
      }
      else {
        postContentWithoutId = `
          <div class="post-row">
            <div class="post-cell id">
              <a href='${issue['Custom.IssueURL']}' title='${issue['Custom.IssueURL']}' target='_blank'>${issue['Custom.IssueID']}</a>
            </div>
            <div class="post-cell title">${issue['System.Title']}</div>
          </div>
        `
      }
      const postContent = postContentWithId ? postContentWithId : postContentWithoutId;
      if (!bodyContent) {
        bodyContent = postContent;
      } else {
        bodyContent += postContent;
      }
    }
    return headerContent + bodyContent + footerContent;
  }

  if (stackOverflow.found.count === 0) {
    soContent = setServiceContentHTML('found', stackOverflow.found.issues);
  } else if (stackOverflow.found.count > 0) {
    const soFoundCount = `<p>Issues Discovered: ${stackOverflow.found.count}</p>`;
    const soFoundContent = setServiceContentHTML('found', stackOverflow.found.issues);
    const soPossibleMatches = `<p>Possible Matching DevOps Issues:</p>`;
    const soDevOpsContent = setServiceContentHTML('devOps', stackOverflow.devOps);
    const soNewCount = stackOverflow.newIssues.count > 0 ? `<p>New Issues: ${stackOverflow.newIssues.count}</p>` : `<p></p>`;
    const soNewContent = setServiceContentHTML('newIssues', stackOverflow.newIssues.issues);
    soContent = soFoundCount + soFoundContent + soPossibleMatches + soDevOpsContent + soNewCount + soNewContent;
  };
  
  if (internalStackOverflow.found.count === 0) {
    isoContent = setServiceContentHTML('found', internalStackOverflow.found.issues);
  } else if (internalStackOverflow.found.count > 0) {
    const isoFoundCount = `<p>Issues Discovered: ${internalStackOverflow.found.count}</p>`;
    const isoFoundContent = setServiceContentHTML('found', internalStackOverflow.found.issues);
    const isoPossibleMatches = `<p>Possible Matching DevOps Issues:</p>`;
    const isoDevOpsContent = setServiceContentHTML('devOps', internalStackOverflow.devOps);
    const isoNewCount = internalStackOverflow.newIssues.count > 0 ? `<p>New Issues: ${internalStackOverflow.newIssues.count}</p>` : `<p></p>`;
    const isoNewContent = setServiceContentHTML('newIssues', internalStackOverflow.newIssues.issues);
    isoContent = isoFoundCount + isoFoundContent + isoPossibleMatches + isoDevOpsContent + isoNewCount + isoNewContent;
  }

  if (github.found.count === 0) {
    ghContent = setServiceContentHTML('found', github.found.issues);
  } else if (github.found.count > 0) {
    const ghFoundCount = `<p>Issues Discovered: ${github.found.count}</p>`;
    const ghFoundContent = setServiceContentHTML('found', github.found.issues);
    const ghPossibleMatches = `<p>Possible Matching DevOps Issues:</p>`;
    const ghDevOpsContent = setServiceContentHTML('devOps', github.devOps);
    const ghNewCount = github.newIssues.count > 0 ? `<p>New Issues: ${github.newIssues.count}</p>` : `<p></p>`;
    const ghNewContent = setServiceContentHTML('newIssues', github.newIssues.issues);
    ghContent = ghFoundCount + ghFoundContent + ghPossibleMatches + ghDevOpsContent + ghNewCount + ghNewContent;
  };

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Support Tracker</title>
    <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .header {
          text-align: center;
          width: 100%;
          padding: 20px 0;
          background-color: #bdbdbd;
        }
        #headerTitle {
          font-size: 24px;
          font-weight: bold;
        }
        #headerDate {
          font-size: 18px;
          font-weight: bold;
          margin-top: 10px;
        }
        .main {
          width: 90%;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 20px;
        }
        .service {
          width: 100%;
          margin: 10px 0;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .processTime {
          background-color: rgb(103, 138, 180, 0.3);
        }
        #stackOverflowService {
          background-color: rgb(244, 111, 28, 0.3);
        }
        #internalStackOverflowService {
          background-color: rgb(255, 205, 37, 0.3);
        }
        #gitHubService {
          background-color: rgb(59, 142, 220, 0.3);
        }
        .post-table {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 5px;
        }
        .post-row {
          display: flex;
          width: 100%;
        }
        .post-row:nth-child(even) {
          background-color: #dae0e3;
        }
        .post-row:nth-child(odd):not(.table-header) {
          background-color: #ffffff;
        }
        .header-cell {
          display: flex;
          padding: 5px;
          border: 1px solid black;
        }
        .header-cell.id {
          border-right: 1px solid black;
        }
        .post-cell {
          display: flex;
          padding: 5px;
          border-bottom: 1px solid black;
          border-bottom: 1px solid black;
          border-bottom: 1px solid black;
          border-bottom: 1px solid black;
        }
        .post-cell.id {
          border-right: 1px solid black;
        }
        .table-header {
          background-color: #c1c1c1;
          font-weight: bold;
        }
        .id {
          display: flex;
          width: 8em;
          min-width: 8em;
        }
        .title {
          display: flex;
          width: 100%;
        }
        
        @media screen and (max-width: 1080px) {
          .header-cell {
            border: 1px solid black;
          }
          .header-cell.id {
            border-right: none;
          }
          .post-cell {
            border-bottom: 1px solid black;
            border-right: 1px solid black;
            border-left: 1px solid black;
          }
          .post-cell.id {
            border-right: none;
          }
          .title {
            display: flex;
            width: 46em;
            min-width: 36em;
          }
        }
    </style>
</head>
<body>
    <div class="header">
        <div id="headerTitle">Support Tracker</div>
        <div id="headerDate"></div>
    </div>
    <div class="main">
        <div class="service processTime" id="processStart">Starting Processes: ${startTime}</div>
        <div class="service" id="stackOverflowService">
          <h2>Stack Overflow</h2>
          ${soContent}
        </div>
        <div class="service" id="internalStackOverflowService">
          <h2>Internal Stack Overflow</h2>
          ${isoContent}
        </div>
        <div class="service" id="gitHubService">
          <h2>GitHub</h2>
          ${ghContent}
        </div>
        <div class="service processTime" id="processEnd">Finished Processes: ${endTime}</div>
    </div>

    <script>
        function updateDate() {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            const today = new Date().toLocaleDateString('en-US', options);
            document.getElementById('headerDate').textContent = today;
        }
        updateDate();
        setInterval(updateDate, 86400000); // Update date every 24 hours
    </script>
</body>
</html>
    `;

    try {
      await fs.writeFile(indexPath, htmlContent);
      console.log('Opening index.html');
      sleep(1000);
      return { indexPath };
    } catch {
        console.error('Failed to create index.html');
    }
}

export { generateIndexHtml };