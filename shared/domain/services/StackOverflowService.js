import axios from 'axios';
import { DevOpsService } from './DevOpsService.js';
import { areObjectsInArrayEmpty, removeDuplicates, sleep, checkAborted } from '../utils.js';

/**
 * StackOverflowService for fetching and processing Stack Overflow questions.
 * Supports AbortController for cancellation.
 */
class StackOverflowService extends DevOpsService {
  constructor({ tags, source }, lastRun, telemetryClient, deps = {}) {
    super(telemetryClient, deps);
    this.tags = tags;
    this.source = source;
    this.lastRun = Math.floor(lastRun.getTime() / 1000);
    this.telemetryClient = telemetryClient;
    this.issuesDb = deps.jsonStore?.issuesDb;
  }

  async process(options = {}) {
    const { signal } = options;
    const possibleDevOpsMatches = [];
    let existingIssuesCount = 0;
    const unassignedIssues = [];
    const items = [];
    let issues = [];

    try {
      const queue = this.tags.map((tag) => async () => this.getIssues(tag, options));

      for (const task of queue) {
        checkAborted(signal);
        const result = await task();
        if (result.length > 0) {
          items.push(...result);
        }
      }

      if (areObjectsInArrayEmpty(items) || items.length === 0) {
        return { status: 204, message: 'No new posts found.' };
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'StackOverflowService');
    }

    try {
      const uniqueIssues = removeDuplicates(items, ({ question_id }) => question_id);

      issues = uniqueIssues.map(({ body, title, question_id }) => ({
        'System.Title': title.slice(0, 255).toString(),
        'Custom.IssueID': question_id,
        'Custom.IssueType': this.source,
        'Custom.IssueURL': `<a href="${this.getUrl(question_id)}">${this.getUrl(question_id)}</a>`,
      }));

      console.log('Posts Found:', issues.length);

      if (this.issuesDb) {
        const isInternal = this.tags.includes('bot-framework');
        const key = isInternal ? 'internalStackOverflow' : 'stackOverflow';
        await this.issuesDb.update(`index.${key}.found.issues`, issues);
        await this.issuesDb.update(`index.${key}.found.count`, issues.length);
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'StackOverflowService');
    }

    try {
      for (const issue of issues) {
        checkAborted(signal);

        const existingIssuesResponse = await this.searchWorkItemByIssueId(issue['Custom.IssueID'], { signal });

        if (existingIssuesResponse.status === 200 && existingIssuesResponse.data.workItems.length === 0) {
          unassignedIssues.push(issue);
        }

        if (existingIssuesResponse.status === 200 && existingIssuesResponse.data.workItems.length > 0) {
          existingIssuesCount += existingIssuesResponse.data.workItems.length;
          const existingIssues = existingIssuesResponse.data.workItems;

          for (const existingIssue of existingIssues) {
            checkAborted(signal);
            const getWorkItemByUrlResponse = await this.getWorkItemByUrl(existingIssue['url'], { signal });

            if (
              getWorkItemByUrlResponse.status === 200 &&
              getWorkItemByUrlResponse.data?.fields?.['Custom.IssueID']
            ) {
              const { org, project } = await this.getAzureDevOpsConfig();
              const workItemId = getWorkItemByUrlResponse.data.id;
              possibleDevOpsMatches.push({
                id: workItemId,
                'Custom.IssueID': issue['Custom.IssueID'],
                'Custom.IssueURL': issue['Custom.IssueURL'],
                'Custom.DevOpsURL': `https://dev.azure.com/${org}/${project}/_workitems/edit/${workItemId}`,
                'System.Title': getWorkItemByUrlResponse.data.fields['System.Title'],
              });
            }
          }
        }
      }

      console.log('Possible Matching Issues:', existingIssuesCount);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'StackOverflowService');
    }

    try {
      if (possibleDevOpsMatches.length === 0) {
        console.log('No Matching Issues Exist');
      } else {
        if (this.issuesDb) {
          const isInternal = this.tags.includes('bot-framework');
          const key = isInternal ? 'internalStackOverflow' : 'stackOverflow';
          await this.issuesDb.update(`index.${key}.devOps`, possibleDevOpsMatches);
        }

        for (const issue of issues) {
          const exists = possibleDevOpsMatches.some(
            (match) =>
              match['Custom.IssueID'] === issue['Custom.IssueID'] &&
              match['System.Title'] === issue['System.Title']
          );
          if (exists && unassignedIssues.length > 0) {
            const index = unassignedIssues.findIndex(
              (u) =>
                u['Custom.IssueID'] === issue['Custom.IssueID'] &&
                u['System.Title'] === issue['System.Title']
            );
            if (index !== -1) {
              unassignedIssues[index].status = 'New';
            }
          }
        }
      }

      if (unassignedIssues.length === 0) {
        return { status: 204, message: 'No new posts to add' };
      }

      console.log('Posts New to DevOps:', unassignedIssues.length);

      if (this.issuesDb) {
        const isInternal = this.tags.includes('bot-framework');
        const key = isInternal ? 'internalStackOverflow' : 'stackOverflow';
        await this.issuesDb.update(`index.${key}.newIssues.issues`, unassignedIssues);
        await this.issuesDb.update(`index.${key}.newIssues.count`, unassignedIssues.length);
      }

      return await this.addIssues(unassignedIssues, { signal });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return await this.errorHandler(error, 'StackOverflowService');
    }
  }

  buildRequestParams(tagged, lastRun) {
    return {
      fromdate: lastRun,
      site: 'stackoverflow',
      filter: 'withbody',
      tagged,
    };
  }

  async fetchStackOverflowIssues(params, config = {}, options = {}) {
    const { signal } = options;
    const url = config.url || 'https://api.stackexchange.com/2.3/questions';
    const headers = {
      ...config.headers,
      'User-Agent': this.tags.includes('bot-framework') ? 'InternalStackOverflowService' : 'StackOverflowService',
    };

    try {
      const response = await axios.get(url, { params, headers, signal });
      return response;
    } catch (error) {
      if (error.response?.status === 429) {
        await sleep(5100);
        return error.response;
      }
      throw error;
    }
  }

  logAndTrackResponse(items) {
    if (items.length > 0 && this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'StackOverflowService',
        measurements: {
          'StackOverflowService.Source': this.source,
          'StackOverflowService.LastRun': this.lastRun,
          'StackOverflowService.Issues': items.length,
        },
      });
    }
  }

  async getIssues(tagged, options = {}) {
    const { signal } = options;
    console.log(`Fetching ${tagged} tagged posts...`);
    await sleep(1500);

    checkAborted(signal);

    const settings = await this.getSettings();
    if (settings.useTestData) {
      return this.getTestData();
    }

    const params = this.buildRequestParams(tagged, this.lastRun);
    const response = this.handleServiceResponse(
      await this.fetchStackOverflowIssues(params, {}, { signal }),
      'StackOverflowService'
    );

    if (response instanceof Error) throw response;

    this.logAndTrackResponse(response.data?.items || []);
    return response.data?.items || [];
  }

  getTestData() {
    return [
      {
        tags: ['azure', 'botframework', 'azure-bot-service'],
        owner: { display_name: 'Test User' },
        is_answered: false,
        question_id: 78853530,
        title: 'Test Stack Overflow Question',
        body: '<p>Test body</p>',
      },
    ];
  }

  getUrl(number) {
    return `https://stackoverflow.com/questions/${number}`;
  }
}

export { StackOverflowService };
