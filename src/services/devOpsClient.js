/**
 * The `DevOpsService` class provides functionality for interacting with Azure DevOps, including creating and managing personal access tokens (PATs), adding issues, and retrieving assigned issues.
 *
 * This class extends the `ErrorHandler` class to handle errors that may occur during the service's operations.
 *
 * @class DevOpsService
 * @extends ErrorHandler
 */
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { ErrorHandler } from '../errorHandler.js';
import { jsonStore } from '../store/jsonStore.js';

/**
 * Environment variables used to configure the Azure DevOps integration.
 * @property {string} AZURE_DEVOPS_API_VERSION - The version of the Azure DevOps API to use.
 * @property {string} AZURE_DEVOPS_ORG - The name of the Azure DevOps organization.
 * @property {string} AZURE_DEVOPS_PAT - The personal access token for the Azure DevOps account.
 * @property {string} AZURE_DEVOPS_PROJECT - The name of the Azure DevOps project.
 * @property {string} AZURE_DEVOPS_USERNAME - The username for the Azure DevOps account.
 */
const {
  AZURE_DEVOPS_API_VERSION,
  AZURE_DEVOPS_ORG,
  AZURE_DEVOPS_PROJECT,
} = process.env;

/**
 * DevOpsService class represents a service for interacting with Azure DevOps.
 * @extends ErrorHandler
 */
class DevOpsService extends ErrorHandler {
  constructor(telemetryClient) {
    super(telemetryClient);
    this.telemetryClient = telemetryClient;
    this.settings = jsonStore.settingsDb.read();
  }

  /**
   * Adds a collection of issues to the Azure DevOps work item tracking system.
   *
   * @param {Object[]} issues - An array of issue objects to be added.
   * @param {string} issues[].key - The key of the issue field to be added.
   * @param {any} issues[].value - The value of the issue field to be added.
   * @returns {Promise<AxiosResponse>} The response from the Azure DevOps API containing the created work items.
   * @throws {Error} If an error occurs during the issue creation process.
   */
  async addIssues(issues) {
    for (const issue of issues) {
      const data = Object.keys(issue).map(key => ({
        "op": "add",
        "path": `/fields/${key}`,
        "from": null,
        "value": issue[key]
      }));

      const credentials = `${(await this.settings).azureDevOpsUserName}:${(await this.settings).azureDevOpsPat}`;
      const buffered = Buffer.from(credentials).toString('base64')
      const raw = CryptoJS.enc.Base64.parse(buffered);
      const encoded = CryptoJS.enc.Base64.stringify(raw);

      const config = {
        method: 'POST',
        url: `https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/wit/workitems/$Issue?api-version=${AZURE_DEVOPS_API_VERSION}`,
        maxBodyLength: Infinity,
        headers: {
          'Content-Type': 'application/json-patch+json',
          'Cookie': 'VstsSession=%7B%22PersistentSessionId%22%3A%22242fa893-94e9-4ba9-8f18-049300915937%22%2C%22PendingAuthenticationSessionId%22%3A%2200000000-0000-0000-0000-000000000000%22%2C%22CurrentAuthenticationSessionId%22%3A%2200000000-0000-0000-0000-000000000000%22%2C%22SignInState%22%3A%7B%7D%7D',
          'Authorization': 'Basic ' + encoded
        },
        data: JSON.stringify(data),
      }

      const response = this.handleServiceResponse(axios.request(config), 'DevOpsService');
      if (await response === typeof Error) {
        const error = await response;
        throw error;
      }
      this.logAndTrackResponse(await Object.create(await response).data, 'addIssues');
      return await response;
    }
  }

  /**
   * Retrieves the assigned issues from the Azure DevOps work item tracking system.
   *
   * @returns {Promise<any[]>} An array of work item details, including the System.Id, System.Title, System.State, and System.AssignedTo fields.
   * @throws {Error} If an error occurs during the retrieval process.
   */
  async getAssignedIssue() {
    const query = {
      query: `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo]
              FROM workitems
              WHERE [System.WorkItemType] = 'Issue'
              AND []`
    };
    console.log('THIS ', await this.settingsDb());
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(':' + (await this.settings).azureDevOpsPat).toString('base64')}`
      }
    };

    // Step 1: Get work item IDs
    return await axios.post(`https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/wit/wiql?api-version=${AZURE_DEVOPS_API_VERSION}`, query, config)
      .then(async response => {
        const workItemIds = response.data.workItems.map(item => item.id).join(',');
        // Step 2: Get detailed information for each work item
        return await axios.get(`https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/wit/workitems?ids=${workItemIds}&fields=System.Id,System.Title,Custom.IssueId&api-version=${AZURE_DEVOPS_API_VERSION}`, {
          auth: {
            username: (await this.settings).azureDevOpsUserName,
            password: (await this.settings).azureDevOpsPat
          },
          headers: {
            'Content-Type': 'application/json-patch+json',
            'Cookie': 'VstsSession=%7B%22PersistentSessionId%22%3A%22242fa893-94e9-4ba9-8f18-049300915937%22%2C%22PendingAuthenticationSessionId%22%3A%2200000000-0000-0000-0000-000000000000%22%2C%22CurrentAuthenticationSessionId%22%3A%2200000000-0000-0000-0000-000000000000%22%2C%22SignInState%22%3A%7B%7D%7D'
          }
        });
      })
      .then(response => {
        this.logAndTrackResponse(response.data, 'getAssignedIssue');
        return response.data.value;
      })
      .catch(error => {
        this.errorHandler(error, 'DevOpsService');
        throw error;
      });
  }

  /**
   * Retrieves the assigned issues from the Azure DevOps work item tracking system.
   *
   * @returns {Promise<any[]>} An array of work item details, including the System.Id, System.Title, System.State, and System.AssignedTo fields.
   * @throws {Error} If an error occurs during the retrieval process.
   */
  async getAssignedIssues() {
    const states = ['To Do', 'Waiting on Customer', 'Waiting on Internal Task', 'Investigating'];

    const query = {
      query: `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo]
              FROM workitems
              WHERE [System.State] IN ('${states.join("','")}')
              AND [System.WorkItemType] = 'Issue'`
    };

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(':' + (await this.settings).azureDevOpsPat).toString('base64')}`
      }
    };

    // Step 1: Get work item IDs
    return await axios.post(`https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/wit/wiql?api-version=${AZURE_DEVOPS_API_VERSION}`, query, config)
      .then(async response => {
        const workItemIds = response.data.workItems.map(item => item.id).join(',');
        // Step 2: Get detailed information for each work item
        return await axios.get(`https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/wit/workitems?ids=${workItemIds}&fields=System.Id,System.Title,Custom.IssueId&api-version=${AZURE_DEVOPS_API_VERSION}`, {
          auth: {
            username: (await this.settings).azureDevOpsUserName,
            password: (await this.settings).azureDevOpsPat
          },
          headers: {
            'Content-Type': 'application/json-patch+json',
            'Cookie': 'VstsSession=%7B%22PersistentSessionId%22%3A%22242fa893-94e9-4ba9-8f18-049300915937%22%2C%22PendingAuthenticationSessionId%22%3A%2200000000-0000-0000-0000-000000000000%22%2C%22CurrentAuthenticationSessionId%22%3A%2200000000-0000-0000-0000-000000000000%22%2C%22SignInState%22%3A%7B%7D%7D'
          }
        });
      })
      .then(response => {
        this.logAndTrackResponse(response.data, getAssignedIssues);
        return response.data.value;
      })
      .catch(error => {
        this.errorHandler(error, 'DevOpsService');
        throw error;
      });
  }

  /**
   * Retrieves a work item from the Azure DevOps work item tracking system using the provided URL.
   *
   * @param {string} url - The URL of the work item to retrieve.
   * @returns {Promise<any>} The work item details.
   * @throws {Error} If an error occurs during the retrieval process.
   */
  async getWorkItemByUrl(url) {

    const credentials = `${(await this.settings).azureDevOpsUsername}:${(await this.settings).azureDevOpsPat}`;
    const buffered = Buffer.from(credentials).toString('base64')
    const raw = CryptoJS.enc.Base64.parse(buffered);
    const encoded = CryptoJS.enc.Base64.stringify(raw);

    const config = {
      method: 'GET',
      url: url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + encoded
      }
    };

    return await axios.request(config)
      .then(response => {
        this.logAndTrackResponse([response.data], 'getWorkItemByUrl');
        return response;
      })
      .catch(error => {
        this.errorHandler(error, 'DevOpsService');
        throw error;
      });
  }

  /**
   * Searches for a work item in the Azure DevOps work item tracking system based on the provided issue ID.
   *
   * @param {string} id - The issue ID to search for.
   * @returns {Promise<any>} The work item details, including its ID, title, state, and assigned user.
   * @throws {Error} If an error occurs during the search process.
   */
  async searchWorkItemByIssueId(id) {
    const query = {
      query: `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo]
              FROM workitems
              WHERE [System.WorkItemType] = 'Issue'
              AND [Custom.IssueID] = '${id}'`
    };

    const credentials = `${(await this.settings).azureDevOpsUsername}:${(await this.settings).azureDevOpsPat}`;
    const buffered = Buffer.from(credentials).toString('base64')
    const raw = CryptoJS.enc.Base64.parse(buffered);
    const encoded = CryptoJS.enc.Base64.stringify(raw);

    const config = {
      url: `https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/wit/wiql?api-version=${AZURE_DEVOPS_API_VERSION}`,
      method: 'POST',
      maxBodyLength: Infinity,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + encoded
      },
      data: JSON.stringify(query)
    };

  // Step 1: Get work item IDs
    return await axios.request(config)
      .then(response => {
        this.logAndTrackResponse(response.data.workItems, 'searchWorkItemByIssueId');
        return response;
      })
      .catch(error => {
        return this.errorHandler(error, 'DevOpsService');
      });
  }

  /**
   * Logs the response items from the Stack Overflow API and tracks the event in telemetry.
   *
   * @param {Array} items - The array of response items from the Stack Overflow API.
   */
  logAndTrackResponse(items, source) {
    if (items) {
      this.telemetryClient.trackEvent({
        name: "DevOpsService.Response",
        measurements: {
          "DevOpsService.EventType": source,
          "DevOpsService.LastRun": new Date().toUTCString(),
          "DevOpsService.Issues": items.length
        }
      });
      // console.debug("DevOps issues:", items.length);
    }
  }
}

export { DevOpsService };