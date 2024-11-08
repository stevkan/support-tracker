import chalk from 'chalk';
import { sleep } from '../utils.js';
import { jsonStore } from '../store/jsonStore.js';

/**
 * Provides an implementation of the StackOverflowService that interacts with the internal Microsoft Stack Overflow Enterprise API.
 *
 * This service extends the base StackOverflowService and overrides the `getIssues` and `getUrl` methods to work with the internal API.
 *
 * The `getIssues` method fetches questions from the internal Stack Overflow Enterprise API, using the provided API key, and returns the response data.
 *
 * The `getUrl` method generates the URL for a specific question on the internal Stack Overflow Enterprise site.
 */
import { StackOverflowService } from './stackOverflowService.js';

/**
 * Represents a service for retrieving internal Stack Overflow issues.
 * @extends StackOverflowService
 */
class InternalStackOverflowService extends StackOverflowService {
  constructor({ tags, source }, lastRun, telemetryClient) {
    super({ tags, source }, lastRun, telemetryClient);
    this.tags = tags;
    this.source = source;
    this.lastRun = Math.floor(lastRun.getTime() / 1000);
    this.telemetryClient = telemetryClient;
    this.settings = jsonStore.settingsDb.read();
  }
  /**
   * Fetches questions from the internal Stack Overflow Enterprise API, using the provided API key, and returns the response data.
   *
   * @param {string[]} tagged - An array of tags to filter the questions by.
   * @returns {Promise<object[]>} - An array of question objects from the internal Stack Overflow Enterprise API.
   */
  async getIssues(tagged) {
    console.log('Fetching ' + chalk.yellow(tagged) + ' tagged posts...');
    await sleep(1000);

    const emptyData = [];
    const testData = [
      {
        "tags": [
          "bot-framework",
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
        "question_id": 419168,
        "content_license": "CC BY-SA 4.0",
        "link": "https://stackoverflow.microsoft.com/questions/419168/azure-bot-oauth-token-not-being-recognized",
        "title": "Azure Bot OAuth Token Not Being Recognized",
        "body": "<p>I have successfully created my chatbot using Microsoft Bot Framework SDK v4 and tested it successfully on the bot emulator and deployed it on azure(Azure Bot).</p>\n<p>Now I want to test it without the bot emulator is it possible?\nAnd another question does somebody know how can I connect my bot with the WhatsApp using Twilio (I have also the service url for the bot(the azure service)\nYour help is much appreciated\nP.S: I am using the JS version for developing the bot</p>\n"
      },
    ];

    const params = this.buildRequestParams(tagged, this.lastRun);
    const headers = {
      'User-Agent': 'InternalStackOverflowService',
      'X-API-Key': process.env.STACK_OVERFLOW_ENTERPRISE_KEY
    };

    console.log('THIS SETTINGS ', (await this.settings).useTestData);
    if (!!(await this.settings).useTestData) return await testData;
    return await this.fetchStackOverflowIssues(params, { url: 'https://stackoverflow.microsoft.com/api/2.3/questions', headers })
      .then(response => {
        this.logAndTrackResponse(response.data.items);
        response.data.items.constructor.source = 'InternalStackOverflowService';
        return response.data.items;
      })
      .catch(error => {
        this.errorHandler(error, 'InternalStackOverflowService');
        throw error;
      });
  }

  /**
   * Generates the URL for a specific question on the internal Stack Overflow Enterprise site.
   *
   * @param {number} number - The ID of the question.
   * @returns {string} - The URL for the specified question.
   */
  getUrl(number) {
    return `https://stackoverflow.microsoft.com/questions/${number}`
  }
}

export { InternalStackOverflowService };