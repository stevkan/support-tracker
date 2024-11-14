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
import chalk from 'chalk';
import { htmlToText } from 'html-to-text';
import { jsonStore } from '../store/jsonStore.js';
import { DevOpsService } from './index.js';
import { areObjectsInArrayEmpty, removeDuplicates, sleep } from '../utils.js';

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

    this.settings = jsonStore.settingsDb.read();
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
   * @returns {Promise<{ error, { status: number, message: string } }>} - An object containing the HTTP status code and a message indicating the result of the operation.
   */
  async process() {
    try {
      const possibleDevOpsMatches = [];
      const unassignedIssues = [];
      let stackOverflowIndicator = chalk.rgb(244, 128, 36)('Stack Overflow Results:');

      /**
       * Fetches questions from Stack Overflow for the provided tags and returns the results as a single array.
       *
       * This method is responsible for the following steps:
       * 1. Fetches questions from Stack Overflow for each tag in `this.tags`.
       * 2. Combines the results from all the tag-specific fetches into a single array.
       *
       * @returns {Promise<Object[]>} - An array of question objects fetched from Stack Overflow.
       */
      const queue = this.tags.map(tag => async () => await this.getIssues(tag));
      if (this.tags.includes('bot-framework')) {
        stackOverflowIndicator = chalk.rgb(255, 176, 37)('Internal Stack Overflow Results:');
      }
      const items = [];
      for (const task of queue) {
        const result = await task();
        if (result.length === 0) {
          continue;
        }
        else {
          items.push(...result);
        }
      }

      if (areObjectsInArrayEmpty(items) === true || items.length === 0) {
        console.groupEnd();
        return {
          status: axios.HttpStatusCode.NoContent,
          message: 'No new posts found.'
        };
      }
      console.groupEnd();
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

      console.group(chalk.blue(stackOverflowIndicator));
      console.log('Posts Found:', issues.length);
      // for (const issue of issues) {
      //   console.debug('Post:', { 'IssueID': issue['Custom.IssueID'], 'Title': issue['System.Title'] });
      // }
      console.table(issues, ['Custom.IssueID', 'System.Title']);

      if (this.tags.includes('bot-framework')) {
        await jsonStore.issuesDb.update('index.internalStackOverflow.found.issues', issues);
        await jsonStore.issuesDb.update('index.internalStackOverflow.found.count', issues.length);
      }
      else {
        await jsonStore.issuesDb.update('index.stackOverflow.found.issues', issues);
        await jsonStore.issuesDb.update('index.stackOverflow.found.count', issues.length);
      }

      console.groupEnd();

      console.groupCollapsed(chalk.rgb(19, 60, 124)('Possible Matching DevOps Issues:'));

      // Iterates over the Stack Overflow issues to check if they already exist in the DevOps system.
      for (const issue of issues) {
        // Processes the unassigned issues by converting the issue description to plain text.
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
        if (existingIssuesResponse.status === axios.HttpStatusCode.Ok && existingIssuesResponse.data.workItems.length === 0) {
          // console.debug('No Issue Exists:', existingIssuesResponse.data.workItems.length);
          unassignedIssues.push(issue);
          // continue;
        }
        // If a possible matching issue is found, its details are added to the `existingIssueDetails` array.
        if (existingIssuesResponse.status === axios.HttpStatusCode.Ok && existingIssuesResponse.data.workItems.length > 0) {
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

            if (getWorkItemByUrlResponse.status === axios.HttpStatusCode.Ok && getWorkItemByUrlResponse.data === undefined) {
              // console.debug('No Matching Issues Exists:', existingIssuesResponse.data);
              // Do nothing and continue to next iteration.
            }
            // else if (getWorkItemByUrlResponse.status === axios.HttpStatusCode.Ok && Number(getWorkItemByUrlResponse.data.fields['Custom.IssueID']) === Number(issue['Custom.IssueID'])) {
            else if (getWorkItemByUrlResponse.status === axios.HttpStatusCode.Ok && getWorkItemByUrlResponse.data && getWorkItemByUrlResponse.data.fields && getWorkItemByUrlResponse.data.fields['Custom.IssueID']) {
              // console.debug('Match?', { 'id': getWorkItemByUrlResponse.data.id, 'IssueID': issue['Custom.IssueID'], 'Title': getWorkItemByUrlResponse.data.fields['System.Title'] });
              possibleDevOpsMatches.push({ 'id': getWorkItemByUrlResponse.data.id, 'Custom.IssueID': issue['Custom.IssueID'], 'System.Title': getWorkItemByUrlResponse.data.fields['System.Title'] });
            }
          }
        }
      };

      if (possibleDevOpsMatches === undefined || possibleDevOpsMatches.length === 0) {
        console.log(chalk.red('No Matching Issues Exist\n'));
      }
      else {
        console.table(possibleDevOpsMatches, ['id', 'Custom.IssueID', 'System.Title']);

        if (this.tags.includes('bot-framework')) {
          await jsonStore.issuesDb.update('index.internalStackOverflow.devOps', possibleDevOpsMatches);
        }
        else {
          await jsonStore.issuesDb.update('index.stackOverflow.devOps', possibleDevOpsMatches);
        }

        
        // Filters the unassigned issues to find new issues that need to be added to the DevOps system.
        for (const issue of issues) {
          const exists = possibleDevOpsMatches.map(existingIssue => existingIssue['Custom.IssueID'] === issue['Custom.IssueID'] && existingIssue['System.Title'] === issue['System.Title']).includes(true);
          if (exists && unassignedIssues.length > 0) {
            const index = unassignedIssues.findIndex(unassignedIssue => unassignedIssue['Custom.IssueID'] === issue['Custom.IssueID'] && unassignedIssue['System.Title'] === issue['System.Title']).status = 'New';
            unassignedIssues.splice(index, 1);
          }
        }
      }

      // console.debug('Unassigned Issues:', unassignedIssues.length, unassignedIssues);

      // If no new issues are found, returns a status code of 204 and a message indicating that no new issues need to be added.
      if (unassignedIssues.length === 0) {
        console.groupEnd();
        return {
          status: axios.HttpStatusCode.NoContent,
          message: 'No new posts to add' };
      }
      console.groupEnd();
      
      console.group(chalk.rgb(19, 60, 124)('DevOps Results:'));
      console.log('Posts New to DevOps: ', unassignedIssues.length);

      console.table(unassignedIssues, ['Custom.IssueID', 'System.Title']);
      console.groupEnd();

      if (this.tags.includes('bot-framework')) {
        await jsonStore.issuesDb.update('index.internalStackOverflow.newIssues.issues', unassignedIssues);
        await jsonStore.issuesDb.update('index.internalStackOverflow.newIssues.count', unassignedIssues.length);
      }
      else {
        await jsonStore.issuesDb.update('index.stackOverflow.newIssues.issues', unassignedIssues);
        await jsonStore.issuesDb.update('index.stackOverflow.newIssues.count', unassignedIssues.length);
      }

      return await this.addIssues(unassignedIssues);
    } catch (error) {
      return await this.errorHandler(error, 'StackOverflowService');
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

    let userAgent = undefined;
    if (this.tags.includes('bot-framework')) {
      userAgent = 'InternalStackOverflowService';
    }
    else {
      userAgent = 'StackOverflowService';
    }
    
    const headers = {
      ...configHeaders,
      'User-Agent': userAgent
    }
    const urlPath = url ? url : 'https://api.stackexchange.com/2.3/questions';
    const response = await axios.get(urlPath, { params, headers })
      .then((resp) => {
        return resp;
      })
      .catch(async (error) => {
        if (error.response.status === 429) {
          await sleep(5100);
          return error.response;
        }
        return error;
      });
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
    console.log('Fetching ' + chalk.yellow(tagged) + ' tagged posts...');
    await sleep(1500);

    const emptyData = [];
    const testData = [
      {
        "tags": [
          "azure",
          "botframework",
          "azure-bot-service"
        ],
        "owner": {
          "reputation": 1,
          "user_id": 21354185,
          "user_type": "registered",
          "profile_image": "https://lh3.googleusercontent.com/a/AGNmyxYbsTM6CYeUTuC-If1UBAaWftVrIdgIN1qX21kw=k-s256",
          "display_name": "Rama Chaker",
          "link": "https://stackoverflow.com/users/21354185/rama-chaker"
        },
        "is_answered": false,
        "view_count": 19,
        "answer_count": 0,
        "score": 0,
        "last_activity_date": 1724239503,
        "creation_date": 1724239503,
        "question_id": 78853530,
        "content_license": "CC BY-SA 4.0",
        "link": "https://stackoverflow.com/questions/78853530/unable-to-tag-or-add-the-response-message-as-a-part-of-the-conversation-thread-from-the-bot-to-the-request-from-the-user-in-skype",
        "title": "Unable to tag or add the response message as a part of the conversation thread from the bot to the request from the user in skype",
        "body": "<p>I have successfully created my chatbot using Microsoft Bot Framework SDK v4 and tested it successfully on the bot emulator and deployed it on azure(Azure Bot).</p>\n<p>Now I want to test it without the bot emulator is it possible?\nAnd another question does somebody know how can I connect my bot with the WhatsApp using Twilio (I have also the service url for the bot(the azure service)\nYour help is much appreciated\nP.S: I am using the JS version for developing the bot</p>\n"
      },
      {
        "tags": [
          "outlook",
          "botframework",
          "adaptive-cards"
        ],
        "owner": {
          "reputation": 547,
          "user_id": 8963682,
          "user_type": "registered",
          "profile_image": "https://www.gravatar.com/avatar/b50bc21920b12a40bbd5d46f7b20817e?s=256&d=identicon&r=PG&f=y&so-version=2",
          "display_name": "NoNam4",
          "link": "https://stackoverflow.com/users/8963682/nonam4"
        },
        "is_answered": false,
        "view_count": 26,
        "answer_count": 1,
        "score": 0,
        "last_activity_date": 1724223923,
        "creation_date": 1724169550,
        "last_edit_date": 1724181953,
        "question_id": 78893407,
        "content_license": "CC BY-SA 4.0",
        "link": "https://stackoverflow.com/questions/78893407/issues-with-action-execute-in-adaptive-card-for-outlook-not-hitting-endpoint",
        "title": "Issues with Action.Execute in Adaptive Card for Outlook: Not Hitting Endpoint",
        "body": "<p>I'm trying to create an interactive Adaptive Card that I can send as JSON to Outlook. My goal is for users to press buttons on the card that will trigger requests to my API. Ideally, I'd like to provide feedback directly on the card, such as changing the button text or disabling it after submission.</p>\n<p>I understand that I can use <code>Action.Http</code>, but I’m limited to version 1.1, which lacks some of the functionality I need. I've seen that <code>Action.Execute</code> is supposed to be a more advanced replacement for <code>Action.Http</code>, but I’m having trouble getting it to work.</p>\n<p><strong>The Issue:</strong></p>\n<ul>\n<li>Action.Execute Behavior: When I click the submit button on the card,\nnothing happens. Instead, I receive an error message saying, &quot;The\naction could not be completed.&quot;</li>\n<li>Provider Registration: I have registered the provider and included my\norganization's originator ID in the Adaptive Card. I’ve also set the\ntarget URL using a regex pattern like\n<code>https://.+\\.exampleapi\\.com/email_actions/.+</code>, but nothing seems to be\nhitting my endpoint.</li>\n<li>Fallback Attempt: I also tried using version 1.4 with Action.Execute\nand added a fallback to Action.Http, but that didn’t resolve the\nissue either.</li>\n</ul>\n<p><strong>What I’ve Observed:</strong></p>\n<ul>\n<li>Browser Network Request: When I click the button, I notice that Outlook makes an internal request to <a href=\"https://outlook.office.com/actionsb2netcore/userid/messages/...\" rel=\"nofollow noreferrer\">https://outlook.office.com/actionsb2netcore/userid/messages/...</a>, but this request doesn't seem to reach my specified endpoint. The request looks something like this:</li>\n</ul>\n<p>JSON:</p>\n<pre><code>{\n  &quot;type&quot;:&quot;invoke&quot;,\n  &quot;name&quot;:&quot;adaptiveCard/action&quot;,\n  &quot;localTimezone&quot;:&quot;&quot;,\n  &quot;localTimestamp&quot;:&quot;&quot;,\n  &quot;value&quot;:{\n    &quot;action&quot;:{\n      &quot;type&quot;:&quot;Action.Execute&quot;,\n      &quot;verb&quot;:&quot;feedbackSubmission&quot;,\n      &quot;data&quot;:{\n        &quot;feedback&quot;:&quot;some feedback&quot;\n      }\n    },\n    &quot;trigger&quot;:&quot;manual&quot;\n  },\n  &quot;from&quot;:{\n    &quot;id&quot;:&quot;user@example.com&quot;\n  },\n  &quot;channelData&quot;:{\n    &quot;connectorSenderGuid&quot;:&quot;some-guid&quot;,\n    &quot;adaptiveCardSignature&quot;:&quot;some-signature&quot;\n  }\n}\n</code></pre>\n<p><strong>Questions:</strong></p>\n<ol>\n<li><p>Scope of Submission: Do I need to submit my provider under the\n&quot;Testing&quot; scope for test users, or should I use the &quot;Organization&quot;\nscope? Could this be affecting why my actions aren't triggering any\nAPI requests?</p>\n</li>\n<li><p>Understanding the Request Flow: Can someone explain what happens\nwhen the button is clicked in the context of Outlook? It seems like\nthe action is being intercepted internally by Outlook but isn't\nreaching my backend.</p>\n</li>\n<li><p>Is there anything specific I should be doing to make Action.Execute\nwork properly in Outlook? Any insights would be greatly appreciated.</p>\n</li>\n<li><p>Do I Need an Azure Bot? Do Adaptive Cards in Outlook need to be processed by an\nAzure Bot to handle user interactions? My goal is to send an email\nwith an Adaptive Card to a user and process the user's actions on\nthe backend by sending some requests. I have a feeling this might\nrequire an Azure Bot, but I’m unsure how to trigger the bot to send\nthe Adaptive Card to the user, especially if the user didn't start a\nconversation or perform any other action first.</p>\n</li>\n</ol>\n"
      }
    ]

    const params = this.buildRequestParams(tagged, this.lastRun);

    if (!!(await this.settings).useTestData) return await testData;
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