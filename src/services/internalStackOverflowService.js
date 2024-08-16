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

  /**
   * Fetches questions from the internal Stack Overflow Enterprise API, using the provided API key, and returns the response data.
   *
   * @param {string[]} tagged - An array of tags to filter the questions by.
   * @returns {Promise<object[]>} - An array of question objects from the internal Stack Overflow Enterprise API.
   */
  async getIssues(tagged) {
      const params = this.buildRequestParams(tagged, this.lastRun);
      const headers = {
        'X-API-Key': process.env.STACK_OVERFLOW_ENTERPRISE_KEY
      }
      return await this.fetchStackOverflowIssues(params, { url: 'https://stackoverflow.microsoft.com/api/2.2/questions', headers })
        .then(response => {
          this.logAndTrackResponse(response.data.items);
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