/**
 * Provides a service for fetching and processing questions from Stack Overflow.
 *
 * The `StackOverflowService` class extends the `DevOpsService` class and is responsible for
 * fetching questions from Stack Overflow, filtering out duplicates, and formatting the
 * questions into a format suitable for adding to a DevOps system.
 *
 * The service takes in a set of tags, a source identifier, the last run timestamp, and a list
 * of assigned issues. It uses these inputs to fetch relevant
 * questions from the Stack Overflow API, process the results, and add any new questions
 * to the DevOps system.
 *
 * The service provides the following methods:
 * - `process()`: Fetches questions from Stack Overflow, filters out duplicates, and adds
 *   any new questions to the DevOps system.
 * - `buildRequestParams(tagged, lastRun)`: Builds the request parameters for the Stack
 *   Overflow API based on the provided tags and last run timestamp.
 * - `fetchStackOverflowIssues(params)`: Fetches questions from the Stack Overflow API
 *   using the provided request parameters.
 * - `logAndTrackResponse(items)`: Logs the number of fetched questions and
 *   tracks the raw response using the provided telemetry object.
 * - `getIssues(tagged)`: Fetches questions for the provided tag and returns the results.
 * - `getUrl(number)`: Generates the URL for a Stack Overflow question based on the
 *   provided question ID.
 */
import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { DevOpsService } from './index.js';
import { removeDuplicates, sleep } from '../utils.js';

const htmlToTextOptions = {
  wordwrap: false,
  decodeEntities: true
}

/**
 * StackOverflowService class for fetching and processing Stack Overflow issues.
 * @class
 * @extends DevOpsService
 */
class StackOverflowService extends DevOpsService {

  /**
   * Constructs a new instance of the StackOverflowService class.
   *
   * @param {object} options - The options for the StackOverflowService instance.
   * @param {string[]} options.tags - The tags to use when fetching questions from Stack Overflow.
   * @param {string} options.source - The source identifier for the StackOverflowService instance.
   * @param {Date} lastRun - The timestamp of the last time the StackOverflowService was run.
   * @param {Object} telemetryClient - The telemetry client to use for logging and reporting.
   */
  constructor({ tags, source }, lastRun, telemetryClient) {
    super();
    this.tags = tags;
    this.source = source;
    this.lastRun = Math.floor(lastRun.getTime() / 1000);
    this.telemetryClient = telemetryClient;
  }

  /**
   * Fetches questions from Stack Overflow, filters out duplicates, and adds any new questions to the DevOps system.
   *
   * This method is responsible for the following steps:
   * 1. Fetches questions from Stack Overflow for the provided tags.
   * 2. Filters out any duplicate questions based on the question ID.
   * 3. Formats the questions into a format suitable for adding to a DevOps system.
   * 4. Filters out any questions that have already been assigned to the DevOps system.
   * 5. Adds any new, unassigned questions to the DevOps system.
   *
   * @returns {Promise<{ status: number, message: string }>} - An object containing the HTTP status code and a message indicating the result of the operation.
   */
  async process() {
    try {
      const existingIssuesDetails = [];
      const unassignedIssues = [];

      /**
       * Fetches questions from Stack Overflow for the provided tags and returns the results as a single array.
       *
       * This method is responsible for the following steps:
       * 1. Fetches questions from Stack Overflow for each tag in `this.tags`.
       * 2. Combines the results from all the tag-specific fetches into a single array.
       *
       * @returns {Promise<Object[]>} - An array of question objects fetched from Stack Overflow.
       */
      const items = await Promise.all(this.tags.map(async tag => await this.getIssues(tag)));
      if (items.length === 0) {
        return {
          status: 200,
          message: 'No new issues found.'
        };
      }
      const uniqueIssues = removeDuplicates(items, ({ question_id }) => question_id);

      /**
       * Maps the unique Stack Overflow issues to an object format suitable for adding to a DevOps system.
       *
       * This method takes an array of unique Stack Overflow issues and maps them to an object with the following properties:
       * - `System.Title`: The title of the Stack Overflow question, truncated to 255 characters.
       * - `System.Description`: The body of the Stack Overflow question.
       * - `Custom.IssueID`: The ID of the Stack Overflow question.
       * - `Custom.IssueType`: The source of the issue, which is set to `this.source`.
       * - `Custom.IssueURL`: A hyperlink to the Stack Overflow question.
       *
       * @param {Object[]} uniqueIssues - An array of unique Stack Overflow issues.
       * @returns {Object[]} - An array of objects representing the Stack Overflow issues in a format suitable for adding to a DevOps system.
       */
      const issues = uniqueIssues.map(({
        body,
        title,
        question_id,
      }) => ({
        "System.Title": title.slice(0, 255).toString(),
        "System.Description": body,
        "Custom.IssueID": question_id,
        "Custom.IssueType": this.source,
        "Custom.IssueURL": `<a href="${this.getUrl(question_id)}"> ${this.getUrl(question_id)} </a>`
      }));

      console.group('Stack Overflow Results:');
      console.warn('Posts Found:', issues.length);
      // for (const issue of issues) {
      //   console.debug('Post:', { 'IssueID': issue['Custom.IssueID'], 'Title': issue['System.Title'] });
      // }
      console.table(issues, ['Custom.IssueID', 'System.Title']);
      console.groupEnd();

      console.groupCollapsed('Possible Matching DevOps Issues:');

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
          // console.debug('No Issue Exists:', existingIssuesResponse.data.workItems.length);
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
            else if (getWorkItemByUrlResponse.status === 200 && Number(getWorkItemByUrlResponse.data.fields['Custom.IssueID']) === Number(issue['Custom.IssueID'])) {
              // console.debug('Match?', { 'id': getWorkItemByUrlResponse.data.id, 'IssueID': issue['Custom.IssueID'], 'Title': getWorkItemByUrlResponse.data.fields['System.Title'] });
              existingIssuesDetails.push({ 'id': getWorkItemByUrlResponse.data.id, 'IssueID': issue['Custom.IssueID'], 'Title': getWorkItemByUrlResponse.data.fields['System.Title'] });
            }
          }
        }

        console.table(existingIssuesDetails, ['id', 'Custom.IssueID', 'System.Title']);
        
        // If the issue already exists, returns a status code of 204 and a message indicating that no new issues need to be added.
        // If the issue does not exist, the issue is added to the `unassignedIssues` array.
        if (existingIssuesDetails.length > 0) {
          console.groupEnd();
          return { status: axios.HttpStatusCode.NoContent, message: 'No new posts to add' };
        }
        else {
          unassignedIssues.push(issue);
        }
      };
      
      // console.debug('Unassigned Issues:', unassignedIssues.length, unassignedIssues);

      // If no new issues are found, returns a status code of 204 and a message indicating that no new issues need to be added.
      if (unassignedIssues.length === 0) {
        console.groupEnd();
        console.warn('No new posts to add');
        return { status: axios.HttpStatusCode.NoContent, message: 'No new posts to add' };
      }
      console.groupEnd();
      console.warn('Posts New to DevOps: ', unassignedIssues.length);

      console.group('New DevOps Issues:');

      // Processes the unassigned issues by converting the issue description to plain text.
      for (const issue of unassignedIssues) {
        issue['System.Description'] = htmlToText(issue['System.Description'], htmlToTextOptions);
        // console.debug('New SO Post:', { 'Custom.IssueID': issue['Custom.IssueID'], 'System.Title': issue['System.Title'] });
      }

      console.table(unassignedIssues, ['Custom.IssueID', 'System.Title']);
      console.groupEnd();

      return await this.addIssues(unassignedIssues);
    } catch (error) {
      this.errorHandler(error, 'StackOverflowService');
      // throw error; // Re-throw the error if you want calling code to handle it
    }
  }

  /**
   * Builds the request parameters for fetching Stack Overflow issues.
   *
   * @param {string} tagged - The tags to filter the Stack Overflow questions by.
   * @param {number} lastRun - The timestamp of the last time the issues were fetched.
   * @returns {Object} - The request parameters object.
   */
  buildRequestParams(tagged, lastRun) {
    return {
      fromdate: lastRun,
      site: "stackoverflow",
      filter: "withbody",
      tagged
    };
  }

  /**
   * Fetches Stack Overflow issues based on the provided parameters.
   *
   * @param {Object} params - The request parameters object.
   * @param {number} params.fromdate - The timestamp of the last time the issues were fetched.
   * @param {string} params.site - The site to fetch the issues from, which is "stackoverflow" in this case.
   * @param {string} params.filter - The filter to apply to the response, which is "withbody" in this case.
   * @param {string} params.tagged - The tags to filter the Stack Overflow questions by.
   * @returns {Promise<Object>} - The response data from the Stack Exchange API.
   */
  async fetchStackOverflowIssues(params, config) {
    let url = undefined;
    let configHeaders = undefined;
    if (config && config.url) {
      url = config.url;
    }
    if (config && config.headers) {
      configHeaders = config.headers
    }

    const headers = {
      ...configHeaders,
    }
    const urlPath = url ? url : 'https://api.stackexchange.com/2.2/questions';
    const response = await axios.get(urlPath, { params, headers });
    return response;
  }

  /**
   * Logs the response items from the Stack Overflow API and tracks the event in telemetry.
   *
   * @param {Array} items - The array of response items from the Stack Overflow API.
   */
  logAndTrackResponse(items) {
    if (items.length > 0) {
      this.telemetryClient.trackEvent({
        name: "StackOverflowService",
        measurements: {
          "StackOverflowService.Source": this.source,
          "StackOverflowService.LastRun": this.lastRun,
          "StackOverflowService.Issues": items.length
        }
      });
      // for (const item of items) {
      //   console.debug("Stackoverflow issue:", item);
      // }
    }
  }

  /**
   * Fetches and logs Stack Overflow issues based on the provided tags.
   *
   * @param {string} tagged - The tags to filter the Stack Overflow questions by.
   * @returns {Promise<Object[]>} - The array of response items from the Stack Overflow API.
   * @throws {Error} - If there is an error fetching the Stack Overflow issues.
   */
  async getIssues(tagged) {
    sleep(1500);
    const params = this.buildRequestParams(tagged, this.lastRun);
    return await this.fetchStackOverflowIssues(params)
      .then(response => {
        this.logAndTrackResponse(response.data.items);
        return response.data.items;
      })
      .catch(error => {
        this.errorHandler(error, 'StackOverflowService');
        throw error;
      });
  }

  /**
   * Generates the URL for a Stack Overflow question based on the provided question number.
   *
   * @param {number} number - The question number to generate the URL for.
   * @returns {string} The URL for the Stack Overflow question.
   */
  getUrl(number) {
      return `https://stackoverflow.com/questions/${number}`
  }
}

export { StackOverflowService };