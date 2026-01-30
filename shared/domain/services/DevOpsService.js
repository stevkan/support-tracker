import axios from 'axios';
import CryptoJS from 'crypto-js';
import { ErrorHandler } from './ErrorHandler.js';
import { checkAborted } from '../utils.js';

/**
 * DevOpsService class for interacting with Azure DevOps.
 * Supports AbortController for cancellation.
 */
class DevOpsService extends ErrorHandler {
  constructor(telemetryClient, deps = {}) {
    super(telemetryClient, deps);
    this.telemetryClient = telemetryClient;
    this.jsonStore = deps.jsonStore;
    this.credentialService = deps.credentialService;
    this.settingsDb = deps.jsonStore?.settingsDb;
  }

  async getSettings() {
    if (this.settingsDb) {
      return await this.settingsDb.read();
    }
    return {};
  }

  async getCredentials() {
    if (!this.credentialService) {
      throw new Error('credentialService not provided');
    }
    const username = await this.credentialService.getAzureDevOpsUsername();
    const pat = await this.credentialService.getAzureDevOpsPat();
    return { username, pat };
  }

  async getAzureDevOpsConfig() {
    const settings = await this.getSettings();
    return {
      org: settings.azureDevOps?.org || '',
      project: settings.azureDevOps?.project || '',
      apiVersion: settings.azureDevOps?.apiVersion || '6.1',
    };
  }

  getEncodedCredentials(username, pat) {
    const credentials = `${username}:${pat}`;
    const buffered = Buffer.from(credentials).toString('base64');
    const raw = CryptoJS.enc.Base64.parse(buffered);
    return CryptoJS.enc.Base64.stringify(raw);
  }

  async addIssues(issues, options = {}) {
    const { signal } = options;
    const { org, project, apiVersion } = await this.getAzureDevOpsConfig();
    let response;

    for (const issue of issues) {
      checkAborted(signal);

      const data = Object.keys(issue).map((key) => ({
        op: 'add',
        path: `/fields/${key}`,
        from: null,
        value: issue[key],
      }));

      const { username, pat } = await this.getCredentials();
      const encoded = this.getEncodedCredentials(username, pat);

      const config = {
        method: 'POST',
        url: `https://dev.azure.com/${org}/${project}/_apis/wit/workitems/$Issue?api-version=${apiVersion}`,
        maxBodyLength: Infinity,
        headers: {
          'Content-Type': 'application/json-patch+json',
          Authorization: 'Basic ' + encoded,
        },
        data: JSON.stringify(data),
        signal,
      };

      response = await axios.request(config);
      response = this.handleServiceResponse(response, 'DevOpsService');
      if (response instanceof Error) {
        throw response;
      }

      this.logAndTrackResponse(response.data, 'addIssues');
    }
    return response;
  }

  async getWorkItemByUrl(url, options = {}) {
    const { signal } = options;
    const { username, pat } = await this.getCredentials();
    const encoded = this.getEncodedCredentials(username, pat);

    const config = {
      method: 'GET',
      url: url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + encoded,
      },
      signal,
    };

    try {
      const response = await axios.request(config);
      this.logAndTrackResponse([response.data], 'getWorkItemByUrl');
      return response;
    } catch (error) {
      this.errorHandler(error, 'DevOpsService');
      throw error;
    }
  }

  async searchWorkItemByIssueId(id, options = {}) {
    const { signal } = options;
    const { org, project, apiVersion } = await this.getAzureDevOpsConfig();

    const query = {
      query: `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo]
              FROM workitems
              WHERE [System.WorkItemType] = 'Issue'
              AND [Custom.IssueID] = '${id}'`,
    };

    const { username, pat } = await this.getCredentials();
    const encoded = this.getEncodedCredentials(username, pat);

    const config = {
      url: `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=${apiVersion}`,
      method: 'POST',
      maxBodyLength: Infinity,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + encoded,
      },
      data: JSON.stringify(query),
      signal,
    };

    try {
      const response = await axios.request(config);
      this.logAndTrackResponse(response.data.workItems, 'searchWorkItemByIssueId');
      return response;
    } catch (error) {
      return this.errorHandler(error, 'DevOpsService');
    }
  }

  async getAssignedIssues(options = {}) {
    const { signal } = options;
    const { org, project, apiVersion } = await this.getAzureDevOpsConfig();
    const states = ['To Do', 'Waiting on Customer', 'Waiting on Internal Task', 'Investigating'];

    const query = {
      query: `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo]
              FROM workitems
              WHERE [System.State] IN ('${states.join("','")}')
              AND [System.WorkItemType] = 'Issue'`,
    };

    const { username, pat } = await this.getCredentials();
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(':' + pat).toString('base64')}`,
      },
      signal,
    };

    try {
      const response = await axios.post(
        `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=${apiVersion}`,
        query,
        config
      );
      const workItemIds = response.data.workItems.map((item) => item.id).join(',');

      checkAborted(signal);

      const detailsResponse = await axios.get(
        `https://dev.azure.com/${org}/${project}/_apis/wit/workitems?ids=${workItemIds}&fields=System.Id,System.Title,Custom.IssueId&api-version=${apiVersion}`,
        {
          auth: { username, password: pat },
          headers: { 'Content-Type': 'application/json-patch+json' },
          signal,
        }
      );

      this.logAndTrackResponse(detailsResponse.data, 'getAssignedIssues');
      return detailsResponse.data.value;
    } catch (error) {
      this.errorHandler(error, 'DevOpsService');
      throw error;
    }
  }

  logAndTrackResponse(items, source) {
    if (items && this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'DevOpsService.Response',
        measurements: {
          'DevOpsService.EventType': source,
          'DevOpsService.LastRun': new Date().toUTCString(),
          'DevOpsService.Issues': Array.isArray(items) ? items.length : 1,
        },
      });
    }
  }
}

export { DevOpsService };
