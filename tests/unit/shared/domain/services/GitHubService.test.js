import axios from 'axios';

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

const mockSecretsStore = {
  getGitHubToken: vi.fn(),
};

const mockCredentialService = {
  getAzureDevOpsUsername: vi.fn(),
  getAzureDevOpsPat: vi.fn(),
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

const createMockGitHubIssue = (number, title = `Issue ${number}`, repoName = 'botbuilder-js', labels = []) => ({
  node: {
    number,
    title,
    url: `https://github.com/microsoft/${repoName}/issues/${number}`,
    createdAt: '2024-06-01T00:00:00Z',
    repository: { name: repoName },
    labels: { nodes: labels.map(name => ({ name })) },
    timelineItems: { edges: [] },
  },
});

const mockTelemetryClient = {
  trackEvent: vi.fn(),
  trackException: vi.fn(),
};

vi.mock('../../../../../shared/domain/utils.js', () => ({
  areObjectsInArrayEmpty: vi.fn((arr) => arr.length === 0),
  getSdk: vi.fn((name) => name),
  removeDuplicates: vi.fn((arr, keyFn) => arr),
  sleep: vi.fn(() => Promise.resolve()),
  checkAborted: vi.fn((signal) => {
    if (signal?.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }
  }),
}));

import { GitHubService } from '../../../../../shared/domain/services/GitHubService.js';
import { checkAborted } from '../../../../../shared/domain/utils.js';

describe('GitHubService', () => {
  let service;
  const lastRun = new Date('2024-01-01T00:00:00Z');
  const repositories = [{ org: 'microsoft', repo: 'botbuilder-js', labels: ['support'] }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockJsonStore.settingsDb.read.mockResolvedValue({
      github: { apiUrl: 'https://api.github.com/graphql' },
      useTestData: false,
    });
    mockSecretsStore.getGitHubToken.mockResolvedValue('test-token');

    service = new GitHubService(
      { repositories, source: 'GitHub' },
      lastRun,
      null,
      { secretsStore: mockSecretsStore, jsonStore: mockJsonStore }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('initializes with repositories, source, and lastRun', () => {
      expect(service.repositories).toBe(repositories);
      expect(service.source).toBe('GitHub');
      expect(service.lastRun).toBe(lastRun);
    });

    it('initializes with dependency injection', () => {
      expect(service.secretsStore).toBe(mockSecretsStore);
      expect(service.issuesDb).toBe(mockJsonStore.issuesDb);
    });

    it('handles missing dependencies gracefully', () => {
      const minimalService = new GitHubService(
        { repositories: [], source: 'GitHub' },
        lastRun,
        null
      );
      expect(minimalService.secretsStore).toBeUndefined();
      expect(minimalService.issuesDb).toBeUndefined();
    });
  });

  describe('getTestData', () => {
    it('returns mock issue data', async () => {
      const mockGithubData = [
        {
          node: {
            createdAt: '2024-08-19T21:43:47Z',
            labels: { nodes: [{ name: 'bug' }, { name: 'Area: Teams' }] },
            number: 6842,
            repository: { name: 'botbuilder-dotnet' },
            timelineItems: { edges: [] },
            title: 'TeamsInfo.SendMessageToTeamsChannelAsync relies on old adapter',
            url: 'https://github.com/microsoft/botbuilder-dotnet/issues/6842',
          },
        },
      ];
      mockTestDataDb.read.mockResolvedValue({ github: mockGithubData });

      const testData = await service.getTestData();

      expect(testData).toHaveLength(1);
      expect(testData[0].node).toBeDefined();
      expect(testData[0].node.number).toBe(6842);
      expect(testData[0].node.title).toBe('TeamsInfo.SendMessageToTeamsChannelAsync relies on old adapter');
      expect(testData[0].node.repository.name).toBe('botbuilder-dotnet');
      expect(testData[0].node.url).toBe('https://github.com/microsoft/botbuilder-dotnet/issues/6842');
    });

    it('includes labels in test data', async () => {
      const mockGithubData = [
        {
          node: {
            createdAt: '2024-08-19T21:43:47Z',
            labels: { nodes: [{ name: 'bug' }, { name: 'Area: Teams' }] },
            number: 6842,
            repository: { name: 'botbuilder-dotnet' },
            timelineItems: { edges: [] },
            title: 'TeamsInfo.SendMessageToTeamsChannelAsync relies on old adapter',
            url: 'https://github.com/microsoft/botbuilder-dotnet/issues/6842',
          },
        },
      ];
      mockTestDataDb.read.mockResolvedValue({ github: mockGithubData });

      const testData = await service.getTestData();
      const labels = testData[0].node.labels.nodes;

      expect(labels).toHaveLength(2);
      expect(labels[0].name).toBe('bug');
      expect(labels[1].name).toBe('Area: Teams');
    });
  });

  describe('getGitHubConfig', () => {
    it('returns API config with token from secretsStore', async () => {
      const config = await service.getGitHubConfig();

      expect(config).toEqual({
        method: 'POST',
        url: 'https://api.github.com/graphql',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('uses default API URL when not configured', async () => {
      mockJsonStore.settingsDb.read.mockResolvedValue({});

      const config = await service.getGitHubConfig();

      expect(config.url).toBe('https://api.github.com/graphql');
    });

    it('throws when secretsStore is missing (no token)', async () => {
      const serviceWithoutSecrets = new GitHubService(
        { repositories, source: 'GitHub' },
        lastRun,
        null,
        { jsonStore: mockJsonStore }
      );

      await expect(serviceWithoutSecrets.getGitHubConfig()).rejects.toThrow(
        'GitHub token is not configured'
      );
    });
  });

  describe('buildQuery', () => {
    it('builds GraphQL query with label filter', () => {
      const query = service.buildQuery('microsoft', 'botbuilder-js', 'support', []);

      expect(query.query).toContain('repo:microsoft/botbuilder-js');
      expect(query.query).toContain('is:open is:issue');
      expect(query.query).toContain('label:\\"support\\"');
      expect(query.query).toContain('created:>2024-01-01T00:00:00');
    });

    it('builds query without label filter when label is null', () => {
      const query = service.buildQuery('microsoft', 'botbuilder-js', null, []);

      expect(query.query).toContain('repo:microsoft/botbuilder-js');
      expect(query.query).not.toContain('label:\\"');
    });

    it('includes ignore labels as negative filters', () => {
      const query = service.buildQuery('microsoft', 'botbuilder-js', 'support', ['wontfix', 'duplicate']);

      expect(query.query).toContain('-label:wontfix');
      expect(query.query).toContain('-label:duplicate');
    });

    it('handles empty ignoreLabels array', () => {
      const query = service.buildQuery('microsoft', 'botbuilder-js', 'support', []);

      expect(query.query).not.toContain('-label:');
    });
  });

  describe('filterIssuesByLabelCreationTime', () => {
    it('filters issues based on label event time after lastRun', async () => {
      const issues = [
        {
          node: {
            timelineItems: {
              edges: [
                {
                  node: {
                    label: { name: 'support' },
                    createdAt: '2024-06-01T00:00:00Z',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = await service.filterIssuesByLabelCreationTime(issues, 'support', []);

      expect(result).toHaveLength(1);
    });

    it('excludes issues with label event before lastRun', async () => {
      const issues = [
        {
          node: {
            timelineItems: {
              edges: [
                {
                  node: {
                    label: { name: 'support' },
                    createdAt: '2023-06-01T00:00:00Z',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = await service.filterIssuesByLabelCreationTime(issues, 'support', []);

      expect(result).toHaveLength(0);
    });

    it('handles case-insensitive label matching', async () => {
      const issues = [
        {
          node: {
            timelineItems: {
              edges: [
                {
                  node: {
                    label: { name: 'SUPPORT' },
                    createdAt: '2024-06-01T00:00:00Z',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = await service.filterIssuesByLabelCreationTime(issues, 'support', []);

      expect(result).toHaveLength(1);
    });

    it('handles issues without matching label events', async () => {
      const issues = [
        {
          node: {
            timelineItems: {
              edges: [
                {
                  node: {
                    label: { name: 'bug' },
                    createdAt: '2024-06-01T00:00:00Z',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = await service.filterIssuesByLabelCreationTime(issues, 'support', []);

      expect(result).toHaveLength(0);
    });

    it('handles issues with empty timeline', async () => {
      const issues = [
        {
          node: {
            timelineItems: { edges: [] },
          },
        },
      ];

      const result = await service.filterIssuesByLabelCreationTime(issues, 'support', []);

      expect(result).toHaveLength(0);
    });

    it('accumulates results into existing array', async () => {
      const existingResult = [{ node: { id: 'existing' } }];
      const issues = [
        {
          node: {
            timelineItems: {
              edges: [
                {
                  node: {
                    label: { name: 'support' },
                    createdAt: '2024-06-01T00:00:00Z',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = await service.filterIssuesByLabelCreationTime(issues, 'support', existingResult);

      expect(result).toHaveLength(2);
      expect(result[0].node.id).toBe('existing');
    });
  });

  describe('getQuery', () => {
    it('returns GraphQL query object with search parameter', () => {
      const query = service.getQuery('repo:test is:open');

      expect(query.query).toContain('search(query: "repo:test is:open"');
      expect(query.query).toContain('type: ISSUE');
      expect(query.query).toContain('last: 100');
    });

    it('includes required fields in query', () => {
      const query = service.getQuery('test');

      expect(query.query).toContain('createdAt');
      expect(query.query).toContain('labels');
      expect(query.query).toContain('number');
      expect(query.query).toContain('repository');
      expect(query.query).toContain('title');
      expect(query.query).toContain('url');
    });

    it('includes timelineItems for label events', () => {
      const query = service.getQuery('test');

      expect(query.query).toContain('timelineItems');
      expect(query.query).toContain('LabeledEvent');
    });
  });

  describe('getIssues with test data mode', () => {
    it('returns test data when useTestData is true', async () => {
      const mockGithubData = [
        {
          node: {
            createdAt: '2024-08-19T21:43:47Z',
            labels: { nodes: [{ name: 'bug' }, { name: 'Area: Teams' }] },
            number: 6842,
            repository: { name: 'botbuilder-dotnet' },
            timelineItems: { edges: [] },
            title: 'TeamsInfo.SendMessageToTeamsChannelAsync relies on old adapter',
            url: 'https://github.com/microsoft/botbuilder-dotnet/issues/6842',
          },
        },
      ];
      mockJsonStore.settingsDb.read.mockResolvedValue({ useTestData: true });
      mockTestDataDb.read.mockResolvedValue({ github: mockGithubData });

      const result = await service.getTestData();

      expect(result).toHaveLength(1);
      expect(result[0].node.number).toBe(6842);
    });
  });

  describe('abort signal handling', () => {
    it('throws AbortError when signal is aborted during getIssues', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        service.getIssues({ org: 'microsoft', repo: 'test' }, { signal: controller.signal })
      ).rejects.toThrow('Aborted');
    });
  });

  describe('validateToken', () => {
    it('returns valid: true for successful token validation', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { login: 'testuser' },
      });
      axios.post.mockResolvedValue({
        status: 200,
        data: { data: { viewer: { login: 'testuser' } } },
      });

      const result = await GitHubService.validateToken('valid-token');

      expect(result).toEqual({ valid: true });
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
            Accept: 'application/vnd.github.v3+json',
          }),
        })
      );
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        { query: '{ viewer { login } }' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
    });

    it('returns error for missing token', async () => {
      const result = await GitHubService.validateToken('');

      expect(result).toEqual({ valid: false, error: 'GitHub token is required' });
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('returns error for null token', async () => {
      const result = await GitHubService.validateToken(null);

      expect(result).toEqual({ valid: false, error: 'GitHub token is required' });
    });

    it('returns error for 401 unauthorized', async () => {
      axios.get.mockRejectedValue({
        response: { status: 401 },
      });

      const result = await GitHubService.validateToken('invalid-token');

      expect(result).toEqual({ valid: false, error: 'Invalid or expired GitHub token' });
    });

    it('returns error for 403 forbidden', async () => {
      axios.get.mockRejectedValue({
        response: { status: 403 },
      });

      const result = await GitHubService.validateToken('limited-token');

      expect(result).toEqual({ valid: false, error: 'GitHub token lacks required permissions' });
    });

    it('returns error for other HTTP status codes', async () => {
      axios.get.mockRejectedValue({
        response: { status: 500 },
      });

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'GitHub API error: 500' });
    });

    it('returns error for network connection failure (ENOTFOUND)', async () => {
      axios.get.mockRejectedValue({ code: 'ENOTFOUND' });

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'Unable to connect to GitHub' });
    });

    it('returns error for network connection failure (ECONNREFUSED)', async () => {
      axios.get.mockRejectedValue({ code: 'ECONNREFUSED' });

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'Unable to connect to GitHub' });
    });

    it('returns generic error message for unknown errors', async () => {
      axios.get.mockRejectedValue(new Error('Something went wrong'));

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'Something went wrong' });
    });

    it('returns error for unexpected response without login', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: {},
      });

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'Unexpected response from GitHub' });
    });

    it('passes abort signal to axios', async () => {
      const controller = new AbortController();
      axios.get.mockResolvedValue({
        status: 200,
        data: { login: 'testuser' },
      });
      axios.post.mockResolvedValue({
        status: 200,
        data: { data: { viewer: { login: 'testuser' } } },
      });

      await GitHubService.validateToken('token', { signal: controller.signal });

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          signal: controller.signal,
        })
      );
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        expect.any(Object),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('includes timeout in request', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { login: 'testuser' },
      });
      axios.post.mockResolvedValue({
        status: 200,
        data: { data: { viewer: { login: 'testuser' } } },
      });

      await GitHubService.validateToken('token');

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          timeout: 10000,
        })
      );
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        expect.any(Object),
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });

    it('returns error when GraphQL returns 401', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { login: 'testuser' },
      });
      axios.post.mockRejectedValue({
        response: { status: 401 },
      });

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'GitHub token is valid but lacks GraphQL API access (check token scopes)' });
    });

    it('returns error when GraphQL returns 403', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { login: 'testuser' },
      });
      axios.post.mockRejectedValue({
        response: { status: 403 },
      });

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'GitHub token lacks permissions for GraphQL API' });
    });

    it('returns error when GraphQL response is missing viewer login', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { login: 'testuser' },
      });
      axios.post.mockResolvedValue({
        status: 200,
        data: { data: {} },
      });

      const result = await GitHubService.validateToken('token');

      expect(result).toEqual({ valid: false, error: 'GitHub token is valid but lacks GraphQL API access (check token scopes)' });
    });

    it('does not call GraphQL when REST validation fails', async () => {
      axios.get.mockRejectedValue({
        response: { status: 401 },
      });

      await GitHubService.validateToken('bad-token');

      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('getIssuesWithLabels', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should iterate through labels and fetch issues for each', async () => {
      const mockConfig = { method: 'POST', url: 'https://api.github.com/graphql', headers: {} };
      axios.mockResolvedValue({
        status: 200,
        data: { data: { search: { edges: [] } } },
      });

      await service.getIssuesWithLabels('microsoft', 'botbuilder-js', ['support', 'bug'], [], mockConfig);

      expect(axios).toHaveBeenCalledTimes(2);
    });

    it('should filter issues by label creation time', async () => {
      const mockConfig = { method: 'POST', url: 'https://api.github.com/graphql', headers: {} };
      const issueWithLabelEvent = {
        node: {
          timelineItems: {
            edges: [{ node: { label: { name: 'support' }, createdAt: '2024-06-01T00:00:00Z' } }],
          },
        },
      };
      axios.mockResolvedValue({
        status: 200,
        data: { data: { search: { edges: [issueWithLabelEvent] } } },
      });

      const result = await service.getIssuesWithLabels('microsoft', 'botbuilder-js', ['support'], [], mockConfig);

      expect(result).toHaveLength(1);
    });
  });

  describe('getIssuesWithoutLabels', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should fetch issues without label filter', async () => {
      const mockConfig = { method: 'POST', url: 'https://api.github.com/graphql', headers: {} };
      axios.mockResolvedValue({
        status: 200,
        data: { data: { search: { edges: [{ node: { number: 123 } }] } } },
      });

      const result = await service.getIssuesWithoutLabels('microsoft', 'botbuilder-js', [], mockConfig);

      expect(result).toHaveLength(1);
      expect(axios).toHaveBeenCalled();
    });

    it('should pass signal through to fetchIssues', async () => {
      const mockConfig = { method: 'POST', url: 'https://api.github.com/graphql', headers: {} };
      const controller = new AbortController();
      axios.mockResolvedValue({
        status: 200,
        data: { data: { search: { edges: [] } } },
      });

      await service.getIssuesWithoutLabels('microsoft', 'botbuilder-js', [], mockConfig, { signal: controller.signal });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('getIssues routing', () => {
    it('should call getIssuesWithLabels when labels are provided', async () => {
      mockJsonStore.settingsDb.read.mockResolvedValue({ useTestData: false });
      axios.mockResolvedValue({
        status: 200,
        data: { data: { search: { edges: [] } } },
      });

      await service.getIssues({ org: 'microsoft', repo: 'botbuilder-js', labels: ['support'] });

      expect(axios).toHaveBeenCalled();
    });

    it('should call getIssuesWithoutLabels when no labels provided', async () => {
      mockJsonStore.settingsDb.read.mockResolvedValue({ useTestData: false });
      axios.mockResolvedValue({
        status: 200,
        data: { data: { search: { edges: [] } } },
      });

      await service.getIssues({ org: 'microsoft', repo: 'botbuilder-js' });

      expect(axios).toHaveBeenCalled();
    });
  });

  describe('process', () => {
    let processService;
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      axios.mockReset();
      axios.request.mockReset();
      axios.get.mockReset();

      mockCredentialService.getAzureDevOpsUsername.mockResolvedValue('testuser');
      mockCredentialService.getAzureDevOpsPat.mockResolvedValue('test-pat');

      mockJsonStore.settingsDb.read.mockResolvedValue({
        useTestData: false,
        github: { apiUrl: 'https://api.github.com/graphql' },
        azureDevOps: { org: 'test-org', project: 'test-project', apiVersion: '6.1' },
      });

      mockJsonStore.issuesDb.update.mockReset();

      processService = new GitHubService(
        { repositories: [{ org: 'microsoft', repo: 'botbuilder-js' }], source: 'GitHub' },
        new Date('2024-01-01'),
        mockTelemetryClient,
        { secretsStore: mockSecretsStore, jsonStore: mockJsonStore, credentialService: mockCredentialService }
      );
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should return 204 when no issues are found', async () => {
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: [] } } } });

      const result = await processService.process();

      expect(result).toEqual({ status: 204, message: 'No new issues found.' });
    });

    it('should call onProgress callback for each repository', async () => {
      processService = new GitHubService(
        {
          repositories: [
            { org: 'microsoft', repo: 'botbuilder-js' },
            { org: 'microsoft', repo: 'botbuilder-dotnet' },
          ],
          source: 'GitHub',
        },
        new Date('2024-01-01'),
        mockTelemetryClient,
        { secretsStore: mockSecretsStore, jsonStore: mockJsonStore, credentialService: mockCredentialService }
      );

      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: [] } } } });

      const onProgress = vi.fn();
      await processService.process({ onProgress });

      expect(onProgress).toHaveBeenCalledWith('botbuilder-js');
      expect(onProgress).toHaveBeenCalledWith('botbuilder-dotnet');
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('should process new issues and add them to DevOps when work items exist but title doesnt match', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'New GitHub Issue')];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });

      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 1, fields: { 'System.Title': 'Different Title' } },
        })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      const result = await processService.process();

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

    it('should add issue to DevOps when no existing work items found', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'New GitHub Issue')];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });

      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      const result = await processService.process();

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('_apis/wit/workitems'),
        })
      );
      expect(result.status).toBe(200);
    });

    it('should update issuesDb with found issues', async () => {
      const mockIssues = [createMockGitHubIssue(12345)];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.found.issues',
        expect.arrayContaining([
          expect.objectContaining({ 'Custom.IssueID': 12345 }),
        ])
      );
      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith('index.github.found.count', 1);
    });

    it('should return 204 when all issues already exist in DevOps with matching title', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'Existing Issue')];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });

      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            id: 1,
            fields: { 'System.Title': 'Existing Issue' },
          },
        });

      const result = await processService.process();

      expect(result).toEqual({ status: 204, message: 'No new issues to add' });
    });

    it('should truncate titles longer than 255 characters', async () => {
      const longTitle = 'A'.repeat(300);
      const mockIssues = [createMockGitHubIssue(12345, longTitle)];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.found.issues',
        expect.arrayContaining([
          expect.objectContaining({
            'System.Title': 'A'.repeat(255),
          }),
        ])
      );
    });

    it('should add [Support Labelled] tag when issue has support label', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'Support Issue', 'botbuilder-js', ['support', 'bug'])];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.found.issues',
        expect.arrayContaining([
          expect.objectContaining({
            'System.Tags': '[Support Labelled]',
          }),
        ])
      );
    });

    it('should add [Support Labelled] tag for "team: support" label (case insensitive)', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'Support Issue', 'botbuilder-js', ['Team: Support'])];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.found.issues',
        expect.arrayContaining([
          expect.objectContaining({
            'System.Tags': '[Support Labelled]',
          }),
        ])
      );
    });

    it('should set empty tags when issue has no support label', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'Bug Issue', 'botbuilder-js', ['bug'])];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.found.issues',
        expect.arrayContaining([
          expect.objectContaining({
            'System.Tags': '',
          }),
        ])
      );
    });

    it('should throw AbortError when signal is aborted during repository loop', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(processService.process({ signal: controller.signal })).rejects.toThrow('Aborted');
    });

    it('should throw AbortError when signal is aborted during issue check loop', async () => {
      const mockIssues = [createMockGitHubIssue(1), createMockGitHubIssue(2)];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });

      const controller = new AbortController();
      let callCount = 0;
      axios.request.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          controller.abort();
        }
        return {
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        };
      });

      await expect(processService.process({ signal: controller.signal })).rejects.toThrow('Aborted');
    });

    it('should handle API errors gracefully and return error via errorHandler', async () => {
      const apiError = new Error('GitHub API failed');
      axios.mockRejectedValue(apiError);

      const result = await processService.process();

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('GitHub API failed');
    });

    it('should save devOps matches to issuesDb when existing work items found', async () => {
      const mockIssues = [
        createMockGitHubIssue(111, 'Issue One'),
        createMockGitHubIssue(222, 'Issue Two'),
      ];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });

      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 1, fields: { 'System.Title': 'Issue One' } },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 2, url: 'https://dev.azure.com/work/2' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 2, fields: { 'System.Title': 'Different Title' } },
        })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.devOps',
        expect.arrayContaining([
          expect.objectContaining({
            'Custom.IssueID': 111,
            'Custom.DevOpsURL': expect.stringContaining('dev.azure.com'),
          }),
        ])
      );
    });

    it('should process without issuesDb when not provided', async () => {
      processService = new GitHubService(
        { repositories: [{ org: 'microsoft', repo: 'botbuilder-js' }], source: 'GitHub' },
        new Date('2024-01-01'),
        mockTelemetryClient,
        { secretsStore: mockSecretsStore, credentialService: mockCredentialService }
      );

      const mockIssues = [createMockGitHubIssue(12345, 'Test Issue')];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 1, fields: { 'System.Title': 'Different Title' } },
        })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      const result = await processService.process();

      expect(result.status).toBe(200);
    });

    it('should update newIssues in issuesDb before adding to DevOps', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'Test Issue')];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 1, fields: { 'System.Title': 'Different Title' } },
        })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.newIssues.issues',
        expect.any(Array)
      );
      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith('index.github.newIssues.count', 1);
    });

    it('should include Custom.SDK based on repository name', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'Test Issue', 'botbuilder-dotnet')];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.found.issues',
        expect.arrayContaining([
          expect.objectContaining({
            'Custom.SDK': 'botbuilder-dotnet',
            'Custom.Repository': 'botbuilder-dotnet',
          }),
        ])
      );
    });

    it('should include Custom.IssueURL as a plain URL', async () => {
      const mockIssues = [createMockGitHubIssue(12345, 'Test Issue')];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });
      axios.request
        .mockResolvedValueOnce({ status: 200, data: { workItems: [] } })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith(
        'index.github.found.issues',
        expect.arrayContaining([
          expect.objectContaining({
            'Custom.IssueURL': 'https://github.com/microsoft/botbuilder-js/issues/12345',
          }),
        ])
      );
    });

    it('should add multiple unassigned issues when titles dont match', async () => {
      const mockIssues = [
        createMockGitHubIssue(111, 'Issue One'),
        createMockGitHubIssue(222, 'Issue Two'),
        createMockGitHubIssue(333, 'Issue Three'),
      ];
      axios.mockResolvedValue({ status: 200, data: { data: { search: { edges: mockIssues } } } });

      axios.request
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 1, url: 'https://dev.azure.com/work/1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 1, fields: { 'System.Title': 'Different' } },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 2, url: 'https://dev.azure.com/work/2' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 2, fields: { 'System.Title': 'Different' } },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { workItems: [{ id: 3, url: 'https://dev.azure.com/work/3' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 3, fields: { 'System.Title': 'Different' } },
        })
        .mockResolvedValueOnce({ status: 200, data: { id: 999 } })
        .mockResolvedValueOnce({ status: 200, data: { id: 998 } })
        .mockResolvedValueOnce({ status: 200, data: { id: 997 } });

      await processService.process();

      expect(mockJsonStore.issuesDb.update).toHaveBeenCalledWith('index.github.newIssues.count', 3);
    });
  });
});
