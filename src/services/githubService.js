/**
 * Provides functionality for interacting with the GitHub API to fetch and process issues.
 *
 * The `GitHubService` class extends the `DevOpsService` class and is responsible for fetching issues from GitHub repositories,
 * filtering them based on labels and creation time, and adding them to a DevOps system.
 *
 * The class has the following main methods:
 * - `process()`: Fetches issues from the configured GitHub repositories, filters them, and adds any new issues to the DevOps system.
 * - `getIssues()`: Fetches issues from a specific GitHub repository, optionally filtering by labels.
 * - `getIssuesWithLabels()`: Fetches issues from a GitHub repository that have specific labels, filtering out issues with certain labels.
 * - `getIssuesWithoutLabels()`: Fetches issues from a GitHub repository that do not have any labels.
 * - `buildQuery()`: Constructs the GraphQL query used to fetch issues from the GitHub API.
 * - `fetchIssues()`: Executes the GraphQL query and returns the fetched issues.
 * - `filterIssuesByLabelCreationTime()`: Filters the fetched issues based on the creation time of the label.
 *
 * The class also includes utility methods for handling GitHub API configuration and error handling.
 */
import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { DevOpsService } from './index.js';
import { getSdk, removeDuplicates } from '../utils.js';

const htmlToTextOptions = {
  wordwrap: false,
  decodeEntities: true
}

/**
 * Represents a service for interacting with GitHub repositories.
 * @class
 * @extends DevOpsService
 */
class GitHubService extends DevOpsService {

  /**
   * Constructs a new instance of the `GitHubService` class.
   *
   * @param {Object} options - The options for configuring the GitHubService instance.
   * @param {Array<string>} options.repositories - The list of GitHub repositories to fetch issues from.
   * @param {string} options.source - The source identifier for the issues being processed.
   * @param {Date} lastRun - The timestamp of the last time the service was run.
   * @param {Object} telemetryClient - The telemetry client to use for logging and reporting.
   */
  constructor({ repositories, source }, lastRun, telemetryClient) {
    super();
    this.repositories = repositories;
    this.source = source;
    this.lastRun = lastRun;
    this.telemetryClient = telemetryClient;
    // this.assignedIssues = assignedIssues;
  }

  /**
   * Processes GitHub issues by fetching them, filtering them, and adding any new issues to the DevOps system.
   *
   * This method retrieves issues from the configured GitHub repositories, filters them based on labels and creation time,
   * and adds any new issues to the DevOps system. It checks if the issues already exist in the DevOps system before adding them.
   *
   * @returns {Promise<{ status: number, message: string }>} - A promise that resolves to an object containing the status code and a message.
   *   - If no new issues are found, the status code is 204 and the message is 'No new issues to add'.
   *   - If new issues are found and added successfully, the status code is 200.
   *   - If an error occurs, the error is handled and the status code and message are returned.
   */
  async process() {
    try {
      const existingIssuesDetails = [];
      const unassignedIssues = [];

      /**
       * Fetches issues from the configured GitHub repositories and stores them in an array.
       *
       * This method iterates through the list of configured GitHub repositories and fetches the issues for each repository using the `getIssues` method. The fetched issues are stored in the `items` array.
       *
       * @returns {Promise<Array>} - A promise that resolves to an array of issues fetched from the GitHub repositories.
       */
      const items = await Promise.all(this.repositories.map(async repository => await this.getIssues(repository)));
      if (items.length === 0) {
        return {
          status: 200,
          message: 'No new issues found.'
        };
      }
      const uniqueIssues = removeDuplicates(items, ({ node: { url }}) => url);

      /**
       * Maps the unique GitHub issues to an array of objects containing the issue details in a format suitable for the DevOps system.
       * 
       * This function takes the array of unique GitHub issues and maps each issue to an object with the following properties:
       * - `System.Title`: The title of the issue, truncated to 255 characters.
       * - `System.Tags`: A tag indicating if the issue has the 'support' or 'team: support' label.
       * - `Custom.IssueID`: The GitHub issue number.
       * - `Custom.IssueType`: The source identifier for the issues being processed.
       * - `Custom.SDK`: The SDK associated with the repository name.
       * - `Custom.Repository`: The name of the repository, in lowercase.
       * - `Custom.IssueURL`: A hyperlink to the GitHub issue.
       *
       * @param {Array<{ node: { number: number, labels: { nodes: Array<{ name: string }>}, repository: { name: string }, title: string, url: string }}}>} uniqueIssues - The array of unique GitHub issues.
       * @returns {Array<Object>} - An array of objects containing the issue details in the format required by the DevOps system.
       */
      const issues = uniqueIssues.map(({ node: { 
        number,
        labels: { 
            nodes: labels
        },
        repository: { 
            name 
        },
        title,
        url
      }}) => ({
        "System.Title": title.slice(0, 255).toString(),
        "System.Tags": `${labels.find(({ name }) => name.toLowerCase() === 'support' || name.toLowerCase() === 'team: support')? '[Support Labelled]': ''}`,
        "Custom.IssueID": number,
        "Custom.IssueType": this.source,
        "Custom.SDK": getSdk(name),
        "Custom.Repository": name.toLowerCase(),
        "Custom.IssueURL": `<a href="${url}"> ${url}</a>`
      }));

      console.group('GitHub Results:');
      console.warn('Issues Found:', issues.length);
      // for (const issue of issues) {
      //   console.debug('New Issue:', { 'IssueID': issue['Custom.IssueID'], 'Title': issue['System.Title'] });
      // }
      console.table(issues, ['Custom.IssueID', 'System.Title']);
      console.groupEnd();

      console.groupCollapsed('Possible Matching DevOps Issues:');

      let issueExists = false;
      
      // Processes the unassigned issues by converting the issue description to plain text.
      for (const issue of issues) {
        issue['System.Description'] = htmlToText(issue['System.Description'], htmlToTextOptions);
        /**
         * Searches for possible existing work item in the DevOps system by its GitHub issue ID.
         *
         * This method makes a request to the DevOps API to check if a work item already exists in any repository for the given GitHub issue ID.
         *
         * @param {number} issueId - The GitHub issue ID to search for.
         * @returns {Promise<Object>} - The response from the DevOps API containing the existing work item details, if any.
         */
        const existingIssuesResponse = await this.searchWorkItemByIssueId(issue['Custom.IssueID']);

        // If no existing issue is found, the issue is added to the `unassignedIssues` array.
        if (existingIssuesResponse.status === 200 && existingIssuesResponse.data.workItems.length === 0) {
          // console.debug('No Issue Exists: ', existingIssuesResponse.data.workItems.length);
          unassignedIssues.push(issue);
          // break;
        }
        // If a possible matching issue is found, its details are added to the `existingIssueDetails` array.
        else if (existingIssuesResponse.status === 200 && existingIssuesResponse.data.workItems.length > 0) {
          const existingIssues = existingIssuesResponse.data.workItems;

          for (const existingIssue of existingIssues) {
            /**
             * Retrieves the details of the possible matching work item in the DevOps system by its URL.
             * 
             * This method makes a request to the DevOps API to fetch the details of a work item based on its URL.
             * 
             * @param {string} url - The URL of the existing work item in the DevOps system.
             * @returns {Promise<Object>} - The response from the DevOps API containing the details of the existing work item.
             */
            const getWorkItemByUrlResponse = await this.getWorkItemByUrl(existingIssue['url']);

            if (getWorkItemByUrlResponse.status === 200 && getWorkItemByUrlResponse.data === undefined) {
              // console.debug('No Matching Issues Exists:', existingIssuesResponse.data);
              // Do nothing and continue to next iteration.
            }
            else if (getWorkItemByUrlResponse.status === 200 && getWorkItemByUrlResponse.data && getWorkItemByUrlResponse.data.id) {
              // console.debug('Match?', { 'id': getWorkItemByUrlResponse.data.id, 'IssueID': issue['Custom.IssueID'], 'Title': getWorkItemByUrlResponse.data.fields['System.Title'] });
              existingIssuesDetails.push({ 'id': getWorkItemByUrlResponse.data.id, 'Custom.IssueID': issue['Custom.IssueID'], 'System.Title': getWorkItemByUrlResponse.data.fields['System.Title'] });

              // This function compares the issue title and repository name of the existing issue to the current issue.
              // If the issue title and repository name match, the issue is considered a duplicate and true is returned.
              issueExists = () => {
                if (getWorkItemByUrlResponse.data.fields['System.Title'] === issue['System.Title'] && getWorkItemByUrlResponse.data.fields['Custom.Repository'] === issue['Custom.Repository']) {
                  // console.debug('Issue already exists:', { 'id': detail.id, 'IssueID': issue['Custom.IssueID'], 'Title': issue['System.Title'] });
                  return getWorkItemByUrlResponse.data;
                }
                return false;
              }
            }
          }
        }
      };
      
      console.table(existingIssuesDetails, ['id', 'Custom.IssueID', 'System.Title']);

      // If the issue already exists, returns a status code of 204 and a message indicating that no new issues need to be added.
      // If the issue does not exist, the issue is added to the `unassignedIssues` array.
      if (issueExists() === false) {
        console.groupEnd();
        return { status: axios.HttpStatusCode.NoContent, message: 'No new issues to add' };
      }
      else {
        const issue = issueExists(); 
        unassignedIssues.push(issue);
      }

      // console.debug('Unassigned Issues:', unassignedIssues.length, unassignedIssues);

      // If no new issues are found, returns a status code of 204 and a message indicating that no new issues need to be added.
      if (unassignedIssues.length === 0) {
        console.groupEnd();
        console.warn('No new issues to add');
        return { status: axios.HttpStatusCode.NoContent, message: 'No new issues to add' };
      }
      console.groupEnd();
      console.warn('Issues New to DevOps:', unassignedIssues.length);

      console.group('New DevOps Issues');

      // Processes the unassigned issues by converting the issue description to plain text.
      for (const issue of unassignedIssues) {
        issue['System.Description'] = htmlToText(issue['System.Description'], htmlToTextOptions);
        // console.debug('New GitHub Issue:', { 'Custom.IssueID': issue['Custom.IssueID'], 'System.Title': issue['System.Title'] });
      }

      console.table(unassignedIssues, ['Custom.IssueID', 'System.Title']);
      console.groupEnd();

      return await this.addIssues(unassignedIssues);
    } catch (error) {
      this.errorHandler(error, 'GitHubService');
      // throw error; // Re-throw the error if you want calling code to handle it
    }
  }

  /**
   * Retrieves GitHub issues based on the provided parameters.
   *
   * @param {Object} options - The options object.
   * @param {string} options.org - The GitHub organization name.
   * @param {string} options.repo - The GitHub repository name.
   * @param {string[]} [options.labels] - An array of GitHub issue labels to filter by.
   * @param {string[]} [options.ignoreLabels] - An array of GitHub issue labels to ignore.
   * @returns {Promise<Object[]>} - An array of GitHub issue objects.
   */
  async getIssues({ org, repo, labels, ignoreLabels = [] }) {
    const config = this.getGitHubConfig();

    if (labels) {
      return this.getIssuesWithLabels(org, repo, labels, ignoreLabels, config);
    } else {
      return this.getIssuesWithoutLabels(org, repo, ignoreLabels, config);
    }
  }

  /**
   * Retrieves the configuration object for making requests to the GitHub GraphQL API.
   *
   * @returns {Object} The configuration object for the GitHub GraphQL API request.
   */
  getGitHubConfig() {
    return {
      method: 'POST',
      url: 'https://api.github.com/graphql',
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json'}
    };
  }

  /**
   * Retrieves GitHub issues with the specified labels, excluding any issues with the specified ignore labels.
   *
   * @param {string} org - The GitHub organization name.
   * @param {string} repo - The GitHub repository name.
   * @param {string[]} labels - An array of GitHub issue labels to filter by.
   * @param {string[]} ignoreLabels - An array of GitHub issue labels to ignore.
   * @param {Object} config - The configuration object for the GitHub GraphQL API request.
   * @returns {Promise<Object[]>} - An array of GitHub issue objects that match the specified labels and exclude the specified ignore labels.
   */
  async getIssuesWithLabels(org, repo, labels, ignoreLabels, config) {
      return labels.reduce(async (result, label) => {
        const query = this.buildQuery(org, repo, label, ignoreLabels);
        const issues = await this.fetchIssues(config, query);
        return this.filterIssuesByLabelCreationTime(issues, label, result);
      }, []);
  }

  /**
   * Retrieves GitHub issues without any specified labels, excluding any issues with the specified ignore labels.
   *
   * @param {string} org - The GitHub organization name.
   * @param {string} repo - The GitHub repository name.
   * @param {string[]} ignoreLabels - An array of GitHub issue labels to ignore.
   * @param {Object} config - The configuration object for the GitHub GraphQL API request.
   * @returns {Promise<Object[]>} - An array of GitHub issue objects that exclude the specified ignore labels.
   */
  async getIssuesWithoutLabels(org, repo, ignoreLabels, config) {
    const query = this.buildQuery(org, repo, null, ignoreLabels);
    const { data: { data: { search: { edges: issues }}}} = await axios({...config, data: query });
    return issues;
  }

  /**
   * Builds a GitHub GraphQL search query to retrieve issues with the specified label, excluding any issues with the specified ignore labels, and created after the last run time.
   *
   * @param {string} org - The GitHub organization name.
   * @param {string} repo - The GitHub repository name.
   * @param {string} [label] - The GitHub issue label to filter by.
   * @param {string[]} ignoreLabels - An array of GitHub issue labels to ignore.
   * @returns {Object} - The GitHub GraphQL search query.
   */
  buildQuery(org, repo, label, ignoreLabels) {
      const labelFilter = label ? `label:\\"${label}\\"` : '';
      const ignoreFilter = ignoreLabels.map(ignore => `-label:${ignore}`).join(' ');
      const dateFilter = `created:>${this.lastRun.toISOString().slice(0, -5)}`;
      const searchQuery = `repo:${org}/${repo} is:open is:issue ${labelFilter} ${dateFilter} ${ignoreFilter}`.trim();
      return this.getQuery(searchQuery);
  }

  /**
   * Fetches GitHub issues based on the provided GraphQL query.
   *
   * @param {Object} config - The configuration object for the GitHub GraphQL API request.
   * @param {Object} query - The GraphQL query to fetch the issues.
   * @returns {Promise<Object[]>} - An array of GitHub issue objects.
   */
  async fetchIssues(config, query) {
    const { data: { data: { search: { edges: issues }}}} = await axios({...config, data: query });
    return issues;
  }

  /**
   * Filters the provided GitHub issues by the specified label and creation time, excluding any issues that were created before the last run time.
   *
   * @param {Object[]} issues - An array of GitHub issue objects.
   * @param {string} label - The GitHub issue label to filter by.
   * @param {Object[]} result - An array to store the filtered issues.
   * @returns {Object[]} - The filtered array of GitHub issue objects.
   */
  async filterIssuesByLabelCreationTime(issues, label, result) {
    for (const issue of issues) {
      const { node: { timelineItems: { edges: events }}} = issue;
      const { node: { createdAt } = {}} = events.filter(item => !!item).find(({ node: { label: { name = '' } = {} }}) => name.toLowerCase() === label.toLowerCase()) || {};

      if (createdAt && new Date(createdAt).getTime() > this.lastRun.getTime()) {
        result.push(issue);
      }
    }
    return result;
  }

  /**
   * Builds a GitHub GraphQL search query to retrieve issues with the specified label, excluding any issues with the specified ignore labels, and created after the last run time.
   *
   * @param {string} search - The search query to use for the GitHub GraphQL API.
   * @returns {Object} - The GitHub GraphQL search query.
   */
  getQuery(search) {
        return { 
            query: 
            `{
                search(query: "${search}", type: ISSUE, last: 100) {
                    edges {
                        node {
                        ... on Issue {
                            createdAt
                            labels(last:10) {
                                nodes {
                                    name
                                }
                            }
                            number
                            repository {
                                name
                            }
                            timelineItems (last: 100) {
                                edges {
                                  node {
                                    __typename
                                    ... on LabeledEvent {
                                      createdAt
                                      label {
                                        name
                                      }
                                    }
                                  }
                                }
                              }
                            title
                            url
                            number
                        }
                        }
                    }
                }
            }`
        }
    }
}

export { GitHubService };