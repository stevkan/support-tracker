import axios from 'axios';

vi.mock('axios');

const mockSecretsStore = {
  getStackOverflowKey: vi.fn(),
};

const mockTestDataDb = {
  read: vi.fn(),
};

const mockJsonStore = {
  settingsDb: {
    read: vi.fn(),
  },
  issuesDb: {
    update: vi.fn(),
  },
  testDataDb: mockTestDataDb,
  reloadTestData: vi.fn(),
};

vi.mock('../../../../../shared/domain/utils.js', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  checkAborted: vi.fn((signal) => {
    if (signal?.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }
  }),
  areObjectsInArrayEmpty: vi.fn(() => false),
  removeDuplicates: vi.fn((arr) => arr),
}));

import { InternalStackOverflowService } from '../../../../../shared/domain/services/InternalStackOverflowService.js';

describe('InternalStackOverflowService', () => {
  let service;
  const mockTelemetryClient = {
    trackEvent: vi.fn(),
  };
  const defaultConfig = { tags: ['bot-framework'], source: 'InternalStackOverflow' };
  const defaultLastRun = new Date('2024-01-01T00:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mockJsonStore.settingsDb.read.mockResolvedValue({ useTestData: false });
    mockSecretsStore.getStackOverflowKey.mockResolvedValue('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      service = new InternalStackOverflowService(
        defaultConfig,
        defaultLastRun,
        mockTelemetryClient,
        { secretsStore: mockSecretsStore, jsonStore: mockJsonStore }
      );

      expect(service.tags).toEqual(['bot-framework']);
      expect(service.source).toBe('InternalStackOverflow');
      expect(service.lastRun).toBe(Math.floor(defaultLastRun.getTime() / 1000));
      expect(service.telemetryClient).toBe(mockTelemetryClient);
      expect(service.secretsStore).toBe(mockSecretsStore);
    });

    it('should handle missing deps', () => {
      service = new InternalStackOverflowService(
        defaultConfig,
        defaultLastRun,
        mockTelemetryClient
      );

      expect(service.secretsStore).toBeUndefined();
    });
  });

  describe('getTestData', () => {
    it('should return mock internal SO data', async () => {
      const mockInternalData = [
        {
          tags: ['bot-framework', 'azure-bot-service'],
          owner: { display_name: 'Internal User' },
          is_answered: false,
          question_id: 419168,
          title: 'Azure Bot OAuth Token Not Being Recognized',
          body: '<p>Test internal body</p>',
        },
      ];
      mockTestDataDb.read.mockResolvedValue({ internalStackOverflow: mockInternalData });

      service = new InternalStackOverflowService(
        defaultConfig,
        defaultLastRun,
        mockTelemetryClient,
        { secretsStore: mockSecretsStore, jsonStore: mockJsonStore }
      );

      const testData = await service.getTestData();

      expect(testData).toEqual(mockInternalData);
    });
  });

  describe('getUrl', () => {
    it('should return internal MS SO URL', () => {
      service = new InternalStackOverflowService(
        defaultConfig,
        defaultLastRun,
        mockTelemetryClient,
        { secretsStore: mockSecretsStore, jsonStore: mockJsonStore }
      );

      expect(service.getUrl(419168)).toBe('https://stackoverflow.microsoft.com/questions/419168');
      expect(service.getUrl(12345)).toBe('https://stackoverflow.microsoft.com/questions/12345');
    });
  });

  describe('getIssues', () => {
    beforeEach(() => {
      service = new InternalStackOverflowService(
        defaultConfig,
        defaultLastRun,
        mockTelemetryClient,
        { secretsStore: mockSecretsStore, jsonStore: mockJsonStore }
      );
    });

    it('should return test data when useTestData is true', async () => {
      const mockInternalData = [
        {
          tags: ['bot-framework', 'azure-bot-service'],
          owner: { display_name: 'Internal User' },
          is_answered: false,
          question_id: 419168,
          title: 'Azure Bot OAuth Token Not Being Recognized',
          body: '<p>Test internal body</p>',
        },
      ];
      mockJsonStore.settingsDb.read.mockResolvedValue({ useTestData: true });
      mockTestDataDb.read.mockResolvedValue({ internalStackOverflow: mockInternalData });

      const result = await service.getTestData();

      expect(result).toEqual(mockInternalData);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch from internal API with X-API-Key header', async () => {
      const mockItems = [{ question_id: 1, title: 'Test' }];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockItems } });

      const result = await service.getIssues('bot-framework');

      expect(axios.get).toHaveBeenCalledWith(
        'https://stackoverflow.microsoft.com/api/2.3/questions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
            'User-Agent': 'InternalStackOverflowService',
          }),
        })
      );
      expect(result).toEqual(mockItems);
    });

    it('should handle null API key when secretsStore is missing', async () => {
      service = new InternalStackOverflowService(
        defaultConfig,
        defaultLastRun,
        mockTelemetryClient,
        { jsonStore: mockJsonStore }
      );
      axios.get.mockResolvedValue({ status: 200, data: { items: [] } });

      await service.getIssues('bot-framework');

      expect(axios.get).toHaveBeenCalledWith(
        'https://stackoverflow.microsoft.com/api/2.3/questions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': null,
          }),
        })
      );
    });

    it('should throw AbortError when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        service.getIssues('bot-framework', { signal: controller.signal })
      ).rejects.toThrow('Aborted');
    });

    it('should return empty array when no items in response', async () => {
      axios.get.mockResolvedValue({ status: 200, data: {} });

      const result = await service.getIssues('bot-framework');

      expect(result).toEqual([]);
    });

    it('should track telemetry for non-empty results', async () => {
      const mockItems = [{ question_id: 1, title: 'Test' }];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockItems } });

      await service.getIssues('bot-framework');

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    it('should return invalid when apiKey is empty', async () => {
      const result = await InternalStackOverflowService.validateApiKey('');

      expect(result).toEqual({
        valid: false,
        error: 'Stack Overflow Enterprise key is required',
      });
    });

    it('should return invalid when apiKey is null', async () => {
      const result = await InternalStackOverflowService.validateApiKey(null);

      expect(result).toEqual({
        valid: false,
        error: 'Stack Overflow Enterprise key is required',
      });
    });

    it('should return valid for successful response', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { items: [{ user_id: 1 }] } });

      const result = await InternalStackOverflowService.validateApiKey('valid-key');

      expect(result).toEqual({ valid: true });
      expect(axios.get).toHaveBeenCalledWith(
        'https://stackoverflow.microsoft.com/api/2.3/me',
        expect.objectContaining({
          headers: {
            'X-API-Key': 'valid-key',
            'User-Agent': 'InternalStackOverflowService',
          },
          timeout: 10000,
        })
      );
    });

    it('should return invalid for unexpected response format', async () => {
      axios.get.mockResolvedValue({ status: 200, data: {} });

      const result = await InternalStackOverflowService.validateApiKey('valid-key');

      expect(result).toEqual({
        valid: false,
        error: 'Unexpected response from Stack Overflow Enterprise',
      });
    });

    it('should return invalid with error message for 401 status', async () => {
      axios.get.mockRejectedValue({ response: { status: 401 } });

      const result = await InternalStackOverflowService.validateApiKey('invalid-key');

      expect(result).toEqual({
        valid: false,
        error: 'Invalid or expired Stack Overflow Enterprise key',
      });
    });

    it('should return invalid with error message for 403 status', async () => {
      axios.get.mockRejectedValue({ response: { status: 403 } });

      const result = await InternalStackOverflowService.validateApiKey('forbidden-key');

      expect(result).toEqual({
        valid: false,
        error: 'Stack Overflow Enterprise key lacks required permissions',
      });
    });

    it('should return invalid with error message for 400 status', async () => {
      axios.get.mockRejectedValue({ response: { status: 400 } });

      const result = await InternalStackOverflowService.validateApiKey('bad-key');

      expect(result).toEqual({
        valid: false,
        error: 'Invalid Stack Overflow Enterprise key',
      });
    });

    it('should return generic API error for other status codes', async () => {
      axios.get.mockRejectedValue({ response: { status: 500 } });

      const result = await InternalStackOverflowService.validateApiKey('some-key');

      expect(result).toEqual({
        valid: false,
        error: 'Stack Overflow Enterprise API error: 500',
      });
    });

    it('should handle ENOTFOUND network error', async () => {
      axios.get.mockRejectedValue({ code: 'ENOTFOUND' });

      const result = await InternalStackOverflowService.validateApiKey('some-key');

      expect(result).toEqual({
        valid: false,
        error: 'Unable to connect to Stack Overflow Enterprise',
      });
    });

    it('should handle ECONNREFUSED network error', async () => {
      axios.get.mockRejectedValue({ code: 'ECONNREFUSED' });

      const result = await InternalStackOverflowService.validateApiKey('some-key');

      expect(result).toEqual({
        valid: false,
        error: 'Unable to connect to Stack Overflow Enterprise',
      });
    });

    it('should handle generic error with message', async () => {
      axios.get.mockRejectedValue(new Error('Network timeout'));

      const result = await InternalStackOverflowService.validateApiKey('some-key');

      expect(result).toEqual({
        valid: false,
        error: 'Network timeout',
      });
    });

    it('should handle generic error without message', async () => {
      axios.get.mockRejectedValue({});

      const result = await InternalStackOverflowService.validateApiKey('some-key');

      expect(result).toEqual({
        valid: false,
        error: 'Validation failed',
      });
    });

    it('should pass abort signal to axios', async () => {
      const controller = new AbortController();
      axios.get.mockResolvedValue({ status: 200, data: { items: [{}] } });

      await InternalStackOverflowService.validateApiKey('valid-key', { signal: controller.signal });

      expect(axios.get).toHaveBeenCalledWith(
        'https://stackoverflow.microsoft.com/api/2.3/me',
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });
});
