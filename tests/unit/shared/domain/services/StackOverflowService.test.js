import axios from 'axios';
import { StackOverflowService } from '../../../../../shared/domain/services/StackOverflowService.js';

vi.mock('axios', () => {
  const mockAxios = vi.fn();
  mockAxios.get = vi.fn();
  mockAxios.post = vi.fn();
  mockAxios.request = vi.fn();
  class MockAxiosError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AxiosError';
      this.isAxiosError = true;
    }
  }
  mockAxios.AxiosError = MockAxiosError;
  return { default: mockAxios, AxiosError: MockAxiosError };
});

const createMockQuestion = (id, title = `Question ${id}`) => ({
  question_id: id,
  title,
  body: `<p>Body for ${title}</p>`,
  tags: ['azure', 'botframework'],
  owner: { display_name: 'Test User' },
  is_answered: false,
});

describe('StackOverflowService', () => {
  let mockSettingsDb;
  let mockIssuesDb;
  let mockTestDataDb;
  let mockJsonStore;
  let mockTelemetryClient;

  beforeEach(() => {
    vi.resetAllMocks();

    mockSettingsDb = {
      read: vi.fn().mockResolvedValue({}),
    };

    mockIssuesDb = {
      update: vi.fn().mockResolvedValue(undefined),
    };

    mockTestDataDb = {
      read: vi.fn(),
    };

    mockJsonStore = {
      settingsDb: mockSettingsDb,
      issuesDb: mockIssuesDb,
      testDataDb: mockTestDataDb,
      reloadTestData: vi.fn(),
    };

    mockTelemetryClient = {
      trackEvent: vi.fn(),
      trackException: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with tags, source, and convert lastRun to unix timestamp', () => {
      const lastRun = new Date('2024-01-15T10:00:00Z');
      const service = new StackOverflowService(
        { tags: ['azure', 'botframework'], source: 'StackOverflow' },
        lastRun,
        mockTelemetryClient,
        { jsonStore: mockJsonStore }
      );

      expect(service.tags).toEqual(['azure', 'botframework']);
      expect(service.source).toBe('StackOverflow');
      expect(service.lastRun).toBe(Math.floor(lastRun.getTime() / 1000));
      expect(service.telemetryClient).toBe(mockTelemetryClient);
      expect(service.issuesDb).toBe(mockIssuesDb);
    });

    it('should handle missing deps gracefully', () => {
      const lastRun = new Date();
      const service = new StackOverflowService(
        { tags: ['test'], source: 'Test' },
        lastRun,
        null
      );

      expect(service.tags).toEqual(['test']);
      expect(service.issuesDb).toBeUndefined();
    });
  });

  describe('buildRequestParams', () => {
    it('should return params object with fromdate, site, filter, and tagged', () => {
      const lastRun = new Date('2024-01-15T10:00:00Z');
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        lastRun,
        mockTelemetryClient
      );

      const params = service.buildRequestParams('botframework', 1705312800);

      expect(params).toEqual({
        fromdate: 1705312800,
        site: 'stackoverflow',
        filter: 'withbody',
        tagged: 'botframework',
      });
    });

    it('should use provided lastRun parameter, not instance lastRun', () => {
      const lastRun = new Date('2024-01-15T10:00:00Z');
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        lastRun,
        mockTelemetryClient
      );

      const customLastRun = 1600000000;
      const params = service.buildRequestParams('azure', customLastRun);

      expect(params.fromdate).toBe(customLastRun);
    });
  });

  describe('getTestData', () => {
    it('should return mock question data', async () => {
      const mockSOData = [
        {
          tags: ['azure', 'botframework', 'azure-bot-service'],
          owner: { display_name: 'Test User' },
          is_answered: false,
          question_id: 78853530,
          title: 'Test Stack Overflow Question',
          body: '<p>Test body</p>',
        },
      ];
      mockTestDataDb.read.mockResolvedValue({ stackOverflow: mockSOData });

      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient,
        { jsonStore: mockJsonStore }
      );

      const testData = await service.getTestData();

      expect(testData).toEqual(mockSOData);
    });
  });

  describe('getUrl', () => {
    it('should return Stack Overflow URL for question ID', () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      expect(service.getUrl(12345)).toBe('https://stackoverflow.com/questions/12345');
      expect(service.getUrl(78853530)).toBe('https://stackoverflow.com/questions/78853530');
    });
  });

  describe('fetchStackOverflowIssues', () => {
    it('should make GET request to Stack Overflow API with params and headers', async () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      const mockResponse = { data: { items: [] }, status: 200 };
      axios.get.mockResolvedValue(mockResponse);

      const params = { fromdate: 123456, site: 'stackoverflow', filter: 'withbody', tagged: 'azure' };
      const result = await service.fetchStackOverflowIssues(params);

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.stackexchange.com/2.3/questions',
        expect.objectContaining({
          params,
          headers: expect.objectContaining({
            'User-Agent': 'StackOverflowService',
          }),
        })
      );
      expect(result).toBe(mockResponse);
    });

    it('should use InternalStackOverflowService user agent when tags include bot-framework', async () => {
      const service = new StackOverflowService(
        { tags: ['bot-framework'], source: 'InternalStackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      axios.get.mockResolvedValue({ data: { items: [] }, status: 200 });

      await service.fetchStackOverflowIssues({});

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'InternalStackOverflowService',
          }),
        })
      );
    });

    it('should use custom URL from config', async () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      axios.get.mockResolvedValue({ data: { items: [] }, status: 200 });

      const customUrl = 'https://custom.api.com/questions';
      await service.fetchStackOverflowIssues({}, { url: customUrl });

      expect(axios.get).toHaveBeenCalledWith(customUrl, expect.any(Object));
    });

    it('should pass signal to axios for abort handling', async () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      axios.get.mockResolvedValue({ data: { items: [] }, status: 200 });

      const controller = new AbortController();
      await service.fetchStackOverflowIssues({}, {}, { signal: controller.signal });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should handle 429 rate limit by sleeping and returning response', async () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      const rateLimitResponse = { status: 429, data: { error_message: 'rate limit exceeded' } };
      const rateLimitError = new Error('Rate limited');
      rateLimitError.response = rateLimitResponse;

      axios.get.mockRejectedValue(rateLimitError);

      const startTime = Date.now();
      const result = await service.fetchStackOverflowIssues({});
      const elapsed = Date.now() - startTime;

      expect(result).toBe(rateLimitResponse);
      expect(elapsed).toBeGreaterThanOrEqual(5000);
    }, 10000);

    it('should throw non-429 errors', async () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      const serverError = new Error('Server error');
      serverError.response = { status: 500 };
      axios.get.mockRejectedValue(serverError);

      await expect(service.fetchStackOverflowIssues({})).rejects.toThrow('Server error');
    });

    it('should throw errors without response property', async () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      const networkError = new Error('Network error');
      axios.get.mockRejectedValue(networkError);

      await expect(service.fetchStackOverflowIssues({})).rejects.toThrow('Network error');
    });
  });

  describe('getIssues', () => {
    it('should return test data when useTestData setting is true', async () => {
      const mockSOData = [
        {
          tags: ['azure', 'botframework', 'azure-bot-service'],
          owner: { display_name: 'Test User' },
          is_answered: false,
          question_id: 78853530,
          title: 'Test Stack Overflow Question',
          body: '<p>Test body</p>',
        },
      ];
      mockSettingsDb.read.mockResolvedValue({ useTestData: true });
      mockTestDataDb.read.mockResolvedValue({ stackOverflow: mockSOData });

      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient,
        { jsonStore: mockJsonStore }
      );

      const result = await service.getTestData();

      expect(result).toEqual(mockSOData);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch from API when useTestData is false', async () => {
      mockSettingsDb.read.mockResolvedValue({ useTestData: false });

      const mockItems = [{ question_id: 1, title: 'Test', body: 'Body' }];
      axios.get.mockResolvedValue({
        status: 200,
        data: { items: mockItems },
      });

      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient,
        { jsonStore: mockJsonStore }
      );

      const result = await service.getIssues('azure');

      expect(axios.get).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });

    it('should throw AbortError when signal is aborted', async () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient,
        { jsonStore: mockJsonStore }
      );

      const controller = new AbortController();
      controller.abort();

      await expect(service.getIssues('azure', { signal: controller.signal }))
        .rejects.toThrow('Aborted');
    });
  });

  describe('abort signal handling', () => {
    it('should pass signal through to fetchStackOverflowIssues', async () => {
      mockSettingsDb.read.mockResolvedValue({ useTestData: false });
      axios.get.mockResolvedValue({ status: 200, data: { items: [] } });

      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient,
        { jsonStore: mockJsonStore }
      );

      const controller = new AbortController();
      await service.getIssues('azure', { signal: controller.signal });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('logAndTrackResponse', () => {
    it('should track event when items exist and telemetryClient is present', () => {
      const lastRun = new Date('2024-01-15T10:00:00Z');
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        lastRun,
        mockTelemetryClient
      );

      service.logAndTrackResponse([{ id: 1 }, { id: 2 }]);

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith({
        name: 'StackOverflowService',
        measurements: {
          'StackOverflowService.Source': 'StackOverflow',
          'StackOverflowService.LastRun': service.lastRun,
          'StackOverflowService.Issues': 2,
        },
      });
    });

    it('should not track event when items array is empty', () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        mockTelemetryClient
      );

      service.logAndTrackResponse([]);

      expect(mockTelemetryClient.trackEvent).not.toHaveBeenCalled();
    });

    it('should not track event when telemetryClient is null', () => {
      const service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date(),
        null
      );

      expect(() => service.logAndTrackResponse([{ id: 1 }])).not.toThrow();
    });
  });

  describe('process', () => {
    let service;
    let mockCredentialService;
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCredentialService = {
        getAzureDevOpsUsername: vi.fn().mockResolvedValue('testuser'),
        getAzureDevOpsPat: vi.fn().mockResolvedValue('test-pat'),
      };

      mockSettingsDb.read.mockResolvedValue({
        useTestData: false,
        azureDevOps: { org: 'test-org', project: 'test-project', apiVersion: '6.1' },
      });

      service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date('2024-01-01'),
        mockTelemetryClient,
        { jsonStore: mockJsonStore, credentialService: mockCredentialService }
      );
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should return 204 when no posts are found', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { items: [] } });

      const result = await service.process();

      expect(result).toEqual({ status: 204, message: 'No new posts found.' });
    });

    it('should call onProgress callback for each tag', async () => {
      service = new StackOverflowService(
        { tags: ['azure', 'botframework'], source: 'StackOverflow' },
        new Date('2024-01-01'),
        mockTelemetryClient,
        { jsonStore: mockJsonStore, credentialService: mockCredentialService }
      );

      axios.get.mockResolvedValue({ status: 200, data: { items: [] } });

      const onProgress = vi.fn();
      await service.process({ onProgress });

      expect(onProgress).toHaveBeenCalledWith('azure');
      expect(onProgress).toHaveBeenCalledWith('botframework');
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('should process new posts and add them to DevOps when no existing work items', async () => {
      const mockQuestions = [createMockQuestion(12345, 'New SO Question')];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });

      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      const result = await service.process();

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('_apis/wit/wiql'),
        })
      );
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('_apis/wit/workitems'),
        })
      );
      expect(result.status).toBe(200);
    });

    it('should update issuesDb with found issues', async () => {
      const mockQuestions = [createMockQuestion(12345)];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await service.process();

      expect(mockIssuesDb.update).toHaveBeenCalledWith(
        'index.stackOverflow.found.issues',
        expect.arrayContaining([
          expect.objectContaining({ 'Custom.IssueID': 12345 }),
        ])
      );
      expect(mockIssuesDb.update).toHaveBeenCalledWith('index.stackOverflow.found.count', 1);
    });

    it('should use internalStackOverflow key when tags include bot-framework', async () => {
      service = new StackOverflowService(
        { tags: ['bot-framework'], source: 'InternalStackOverflow' },
        new Date('2024-01-01'),
        mockTelemetryClient,
        { jsonStore: mockJsonStore, credentialService: mockCredentialService }
      );

      const mockQuestions = [createMockQuestion(12345)];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await service.process();

      expect(mockIssuesDb.update).toHaveBeenCalledWith(
        'index.internalStackOverflow.found.issues',
        expect.any(Array)
      );
    });

    it('should return 204 when all posts already exist in DevOps', async () => {
      const mockQuestions = [createMockQuestion(12345, 'Existing Question')];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });

      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            id: 1,
            fields: {
              'Custom.IssueID': 12345,
              'System.Title': 'Existing Question',
            },
          },
        });

      const result = await service.process();

      expect(result).toEqual({ status: 204, message: 'No new posts to add' });
    });

    it('should deduplicate posts with same question_id', async () => {
      const duplicateQuestions = [
        createMockQuestion(12345, 'Same Question'),
        createMockQuestion(12345, 'Same Question'),
      ];
      axios.get.mockResolvedValue({ status: 200, data: { items: duplicateQuestions } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await service.process();

      expect(mockIssuesDb.update).toHaveBeenCalledWith('index.stackOverflow.found.count', 1);
    });

    it('should truncate titles longer than 255 characters', async () => {
      const longTitle = 'A'.repeat(300);
      const mockQuestions = [createMockQuestion(12345, longTitle)];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await service.process();

      expect(mockIssuesDb.update).toHaveBeenCalledWith(
        'index.stackOverflow.found.issues',
        expect.arrayContaining([
          expect.objectContaining({
            'System.Title': 'A'.repeat(255),
          }),
        ])
      );
    });

    it('should throw AbortError when signal is aborted during tag loop', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(service.process({ signal: controller.signal })).rejects.toThrow('Aborted');
    });

    it('should throw AbortError when signal is aborted during issue check loop', async () => {
      const mockQuestions = [
        createMockQuestion(1),
        createMockQuestion(2),
      ];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });

      const controller = new AbortController();
      axios.request.mockImplementation(async () => {
        controller.abort();
        return { status: 200, data: { workItems: [] } };
      });

      await expect(service.process({ signal: controller.signal })).rejects.toThrow('Aborted');
    });

    it('should handle API errors gracefully and return error via errorHandler', async () => {
      const apiError = new Error('API failed');
      axios.get.mockRejectedValue(apiError);

      const result = await service.process();

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('API failed');
    });

    it('should save devOps matches to issuesDb when existing work items found', async () => {
      const mockQuestions = [
        createMockQuestion(111, 'Question One'),
        createMockQuestion(222, 'Question Two'),
      ];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });

      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 1, fields: { 'Custom.IssueID': 111, 'System.Title': 'Question One' } },
        })
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await service.process();

      expect(mockIssuesDb.update).toHaveBeenCalledWith(
        'index.stackOverflow.devOps',
        expect.arrayContaining([
          expect.objectContaining({
            'Custom.IssueID': 111,
            'Custom.DevOpsURL': expect.stringContaining('dev.azure.com'),
          }),
        ])
      );
    });

    it('should process without issuesDb when not provided', async () => {
      service = new StackOverflowService(
        { tags: ['azure'], source: 'StackOverflow' },
        new Date('2024-01-01'),
        mockTelemetryClient,
        { credentialService: mockCredentialService }
      );

      const mockQuestions = [createMockQuestion(12345)];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      const result = await service.process();

      expect(result.status).toBe(200);
    });

    it('should update newIssues in issuesDb before adding to DevOps', async () => {
      const mockQuestions = [createMockQuestion(12345)];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await service.process();

      expect(mockIssuesDb.update).toHaveBeenCalledWith(
        'index.stackOverflow.newIssues.issues',
        expect.any(Array)
      );
      expect(mockIssuesDb.update).toHaveBeenCalledWith('index.stackOverflow.newIssues.count', 1);
    });

    it('should mark matching issues as New when they exist in unassignedIssues', async () => {
      const mockQuestions = [
        createMockQuestion(111, 'Question One'),
        createMockQuestion(222, 'Question Two'),
      ];
      axios.get.mockResolvedValue({ status: 200, data: { items: mockQuestions } });

      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 1, fields: { 'Custom.IssueID': 222, 'System.Title': 'Question Two' } },
        })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await service.process();

      expect(mockIssuesDb.update).toHaveBeenCalledWith('index.stackOverflow.newIssues.count', 1);
    });

  });
});
