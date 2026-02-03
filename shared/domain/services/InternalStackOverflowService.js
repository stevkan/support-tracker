import axios from 'axios';
import { StackOverflowService } from './StackOverflowService.js';
import { sleep, checkAborted } from '../utils.js';

/**
 * InternalStackOverflowService for fetching from internal Microsoft Stack Overflow.
 * Supports AbortController for cancellation.
 */
class InternalStackOverflowService extends StackOverflowService {
  constructor({ tags, source }, lastRun, telemetryClient, deps = {}) {
    super({ tags, source }, lastRun, telemetryClient, deps);
    this.tags = tags;
    this.source = source;
    this.lastRun = Math.floor(lastRun.getTime() / 1000);
    this.telemetryClient = telemetryClient;
    this.secretsStore = deps.secretsStore;
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
    const apiKey = this.secretsStore ? await this.secretsStore.getStackOverflowKey() : null;

    const config = {
      url: 'https://stackoverflow.microsoft.com/api/2.3/questions',
      headers: {
        'User-Agent': 'InternalStackOverflowService',
        'X-API-Key': apiKey,
      },
    };

    const response = this.handleServiceResponse(
      await this.fetchStackOverflowIssues(params, config, { signal }),
      'InternalStackOverflowService'
    );

    if (response instanceof Error) throw response;

    this.logAndTrackResponse(response.data?.items || []);
    return response.data?.items || [];
  }

  getTestData() {
    return [
      {
        tags: ['bot-framework', 'azure-bot-service'],
        owner: { display_name: 'Internal User' },
        is_answered: false,
        question_id: 419168,
        title: 'Azure Bot OAuth Token Not Being Recognized',
        body: '<p>Test internal body</p>',
      },
    ];
  }

  getUrl(number) {
    return `https://stackoverflow.microsoft.com/questions/${number}`;
  }

  /**
   * Validates a Stack Overflow Enterprise API key.
   * @param {string} apiKey - The API key to validate
   * @param {Object} options - { signal } for AbortController
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  static async validateApiKey(apiKey, options = {}) {
    const { signal } = options;

    if (!apiKey) {
      return { valid: false, error: 'Stack Overflow Enterprise key is required' };
    }

    try {
      const response = await axios.get('https://stackoverflow.microsoft.com/api/2.3/me', {
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'InternalStackOverflowService',
        },
        signal,
        timeout: 10000,
      });

      if (response.status === 200 && response.data?.items) {
        return { valid: true };
      }
      return { valid: false, error: 'Unexpected response from Stack Overflow Enterprise' };
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          return { valid: false, error: 'Invalid or expired Stack Overflow Enterprise key' };
        }
        if (status === 403) {
          return { valid: false, error: 'Stack Overflow Enterprise key lacks required permissions' };
        }
        if (status === 400) {
          return { valid: false, error: 'Invalid Stack Overflow Enterprise key' };
        }
        return { valid: false, error: `Stack Overflow Enterprise API error: ${status}` };
      }
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return { valid: false, error: 'Unable to connect to Stack Overflow Enterprise' };
      }
      return { valid: false, error: error.message || 'Validation failed' };
    }
  }
}

export { InternalStackOverflowService };
