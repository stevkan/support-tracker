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
}

export { InternalStackOverflowService };
