import axios, { AxiosError } from 'axios';
import { DevOpsService } from './DevOpsService.js';
import { areObjectsInArrayEmpty, getSdk, removeDuplicates, sleep, checkAborted } from '../utils.js';

/**
 * GitHubService for fetching and processing GitHub issues.
 * Supports AbortController for cancellation.
 */
class GitHubService extends DevOpsService {
  constructor({ repositories, source }, lastRun, telemetryClient, deps = {}) {
    super(telemetryClient, deps);
    this.repositories = repositories;
    this.source = source;
    this.lastRun = lastRun;
    this.telemetryClient = telemetryClient;
    this.secretsStore = deps.secretsStore;
    this.issuesDb = deps.jsonStore?.issuesDb;
  }

  async process(options = {}) {
    const { signal } = options;
    const existingIssuesDetails = [];
    let existingIssuesCount = 0;
    const unassignedIssues = [];
    const items = [];
    let issues = [];

    try {
      const queue = this.repositories.map((repository) => async () => this.getIssues(repository, { signal }));
      for (const task of queue) {
        checkAborted(signal);
        const result = await task();
        if (result.length > 0) {
          items.push(...result);
        }
      }

      if (areObjectsInArrayEmpty(items) || items.length === 0) {
        return { status: 204, message: 'No new issues found.' };
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'GitHubService');
    }

    try {
      const uniqueIssues = removeDuplicates(items, ({ node: { url } }) => url);

      issues = uniqueIssues.map(({ node: { number, labels: { nodes: labels }, repository: { name }, title, url } }) => ({
        'System.Title': title.slice(0, 255).toString(),
        'System.Tags': `${labels.find(({ name }) => name.toLowerCase() === 'support' || name.toLowerCase() === 'team: support') ? '[Support Labelled]' : ''}`,
        'Custom.IssueID': number,
        'Custom.IssueType': this.source,
        'Custom.SDK': getSdk(name),
        'Custom.Repository': name.toLowerCase(),
        'Custom.IssueURL': url,
      }));

      console.log('Issues Found:', issues.length);

      if (this.issuesDb) {
        await this.issuesDb.update('index.github.found.issues', issues);
        await this.issuesDb.update('index.github.found.count', issues.length);
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'GitHubService');
    }

    try {
      for (const issue of issues) {
        checkAborted(signal);

        const existingIssuesResponse = await this.searchWorkItemByIssueId(issue['Custom.IssueID'], { signal });

        if (existingIssuesResponse instanceof AxiosError) {
          return this.errorHandler(existingIssuesResponse, 'GitHubService');
        }

        if (existingIssuesResponse.status === 200 && existingIssuesResponse.data.workItems.length === 0) {
          continue;
        }

        if (existingIssuesResponse.status === 200 && existingIssuesResponse.data.workItems.length > 0) {
          existingIssuesCount += existingIssuesResponse.data.workItems.length;
          const existingIssues = existingIssuesResponse.data.workItems;

          for (const existingIssue of existingIssues) {
            checkAborted(signal);
            const getWorkItemByUrlResponse = await this.getWorkItemByUrl(existingIssue['url'], { signal });

            if (getWorkItemByUrlResponse.status === 200 && getWorkItemByUrlResponse.data?.id) {
              const { org, project } = await this.getAzureDevOpsConfig();
              const workItemId = getWorkItemByUrlResponse.data.id;
              existingIssuesDetails.push({
                id: workItemId,
                'Custom.IssueID': issue['Custom.IssueID'],
                'Custom.IssueURL': issue['Custom.IssueURL'],
                'Custom.DevOpsURL': `https://dev.azure.com/${org}/${project}/_workitems/edit/${workItemId}`,
                'Custom.Repository': issue['Custom.Repository'],
                'System.Title': getWorkItemByUrlResponse.data.fields['System.Title'],
              });
            }
          }
        }
      }

      console.log('Possible Matching Issues:', existingIssuesCount);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'GitHubService');
    }

    try {
      if (existingIssuesDetails.length === 0) {
        console.log('No Matching Issues Exist');
      } else {
        if (this.issuesDb) {
          await this.issuesDb.update('index.github.devOps', existingIssuesDetails);
        }

        for (const issue of issues) {
          const exists = existingIssuesDetails.some(
            (existingIssue) =>
              existingIssue['Custom.IssueID'] === issue['Custom.IssueID'] &&
              existingIssue['System.Title'] === issue['System.Title']
          );
          if (!exists) {
            unassignedIssues.push(issue);
          }
        }
      }

      if (unassignedIssues.length === 0) {
        return { status: 204, message: 'No new issues to add' };
      }

      console.log('New Issues to Add:', unassignedIssues.length);

      if (this.issuesDb) {
        await this.issuesDb.update('index.github.newIssues.issues', unassignedIssues);
        await this.issuesDb.update('index.github.newIssues.count', unassignedIssues.length);
      }

      return await this.addIssues(unassignedIssues, { signal });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'GitHubService');
    }
  }

  async getIssues({ org, repo, labels, ignoreLabels = [] }, options = {}) {
    const { signal } = options;
    console.log(`Fetching ${repo} issues...`);
    await sleep(300);

    checkAborted(signal);

    const settings = await this.getSettings();
    if (settings.useTestData) {
      return this.getTestData();
    }

    const config = await this.getGitHubConfig();
    if (labels) {
      return this.getIssuesWithLabels(org, repo, labels, ignoreLabels, config, { signal });
    } else {
      return this.getIssuesWithoutLabels(org, repo, ignoreLabels, config, { signal });
    }
  }

  getTestData() {
    return [
      {
        node: {
          createdAt: '2024-08-19T21:43:47Z',
          labels: { nodes: [{ name: 'bug' }, { name: 'Area: Teams' }] },
          number: 6842,
          repository: { name: 'botbuilder-dotnet' },
          timelineItems: { edges: [] },
          title: 'TeamsInfo.SendMessageToTeamsChannelAsync relies on old adapter',
          url: 'https://github.com/microsoft/botbuilder-dotnet/issues/6842',
        },
      },
    ];
  }

  async getGitHubConfig() {
    const settings = await this.getSettings();
    const token = this.secretsStore ? await this.secretsStore.getGitHubToken() : null;
    return {
      method: 'POST',
      url: settings.github?.apiUrl || 'https://api.github.com/graphql',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
  }

  async getIssuesWithLabels(org, repo, labels, ignoreLabels, config, options = {}) {
    const { signal } = options;
    let result = [];
    for (const label of labels) {
      checkAborted(signal);
      const query = this.buildQuery(org, repo, label, ignoreLabels);
      const response = this.handleServiceResponse(await this.fetchIssues(config, query, { signal }), 'GitHubService');

      if (response instanceof Error) throw response;

      const issues = response.data?.data?.search?.edges || [];
      this.logAndTrackResponse(issues, 'getIssuesWithLabels');
      result = await this.filterIssuesByLabelCreationTime(issues, label, result);
    }
    return result;
  }

  async getIssuesWithoutLabels(org, repo, ignoreLabels, config, options = {}) {
    const { signal } = options;
    const query = this.buildQuery(org, repo, null, ignoreLabels);
    const response = this.handleServiceResponse(await this.fetchIssues(config, query, { signal }), 'GitHubService');

    if (response instanceof Error) throw response;

    const issues = response.data?.data?.search?.edges || [];
    this.logAndTrackResponse(issues, 'getIssuesWithoutLabels');
    return issues;
  }

  buildQuery(org, repo, label, ignoreLabels) {
    const labelFilter = label ? `label:\\"${label}\\"` : '';
    const ignoreFilter = ignoreLabels.map((ignore) => `-label:${ignore}`).join(' ');
    const dateFilter = `created:>${this.lastRun.toISOString().slice(0, -5)}`;
    const searchQuery = `repo:${org}/${repo} is:open is:issue ${labelFilter} ${dateFilter} ${ignoreFilter}`.trim();
    return this.getQuery(searchQuery);
  }

  async fetchIssues(config, query, options = {}) {
    const { signal } = options;
    return await axios({ ...config, data: query, signal });
  }

  async filterIssuesByLabelCreationTime(issues, label, result) {
    for (const issue of issues) {
      const events = issue.node?.timelineItems?.edges || [];
      const labelEvent = events.find(({ node }) => node?.label?.name?.toLowerCase() === label.toLowerCase());
      const createdAt = labelEvent?.node?.createdAt;

      if (createdAt && new Date(createdAt).getTime() > this.lastRun.getTime()) {
        result.push(issue);
      }
    }
    return result;
  }

  getQuery(search) {
    return {
      query: `{
        search(query: "${search}", type: ISSUE, last: 100) {
          edges {
            node {
              ... on Issue {
                createdAt
                labels(last:10) { nodes { name } }
                number
                repository { name }
                timelineItems (last: 100) {
                  edges {
                    node {
                      __typename
                      ... on LabeledEvent {
                        createdAt
                        label { name }
                      }
                    }
                  }
                }
                title
                url
              }
            }
          }
        }
      }`,
    };
  }

  /**
   * Validates a GitHub token by calling the user endpoint.
   * @param {string} token - The GitHub token to validate
   * @param {Object} options - { signal } for AbortController
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  static async validateToken(token, options = {}) {
    const { signal } = options;

    if (!token) {
      return { valid: false, error: 'GitHub token is required' };
    }

    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        signal,
        timeout: 10000,
      });

      if (response.status === 200 && response.data?.login) {
        return { valid: true };
      }
      return { valid: false, error: 'Unexpected response from GitHub' };
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          return { valid: false, error: 'Invalid or expired GitHub token' };
        }
        if (status === 403) {
          return { valid: false, error: 'GitHub token lacks required permissions' };
        }
        return { valid: false, error: `GitHub API error: ${status}` };
      }
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return { valid: false, error: 'Unable to connect to GitHub' };
      }
      return { valid: false, error: error.message || 'Validation failed' };
    }
  }
}

export { GitHubService };
