import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DevOpsService } from '../../../../../shared/domain/services/DevOpsService.js';

vi.mock('axios');

describe('DevOpsService', () => {
  let service;
  let mockCredentialService;
  let mockJsonStore;
  let mockTelemetryClient;

  const mockSettings = {
    azureDevOps: {
      org: 'test-org',
      project: 'test-project',
      apiVersion: '7.0',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockCredentialService = {
      getAzureDevOpsUsername: vi.fn().mockResolvedValue('testuser'),
      getAzureDevOpsPat: vi.fn().mockResolvedValue('test-pat-token'),
    };

    mockJsonStore = {
      settingsDb: {
        read: vi.fn().mockResolvedValue(mockSettings),
      },
    };

    mockTelemetryClient = {
      trackEvent: vi.fn(),
      trackException: vi.fn(),
    };

    service = new DevOpsService(mockTelemetryClient, {
      jsonStore: mockJsonStore,
      credentialService: mockCredentialService,
    });
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(service.telemetryClient).toBe(mockTelemetryClient);
      expect(service.jsonStore).toBe(mockJsonStore);
      expect(service.credentialService).toBe(mockCredentialService);
      expect(service.settingsDb).toBe(mockJsonStore.settingsDb);
    });

    it('should handle missing jsonStore gracefully', () => {
      const serviceWithoutStore = new DevOpsService(mockTelemetryClient, {
        credentialService: mockCredentialService,
      });
      expect(serviceWithoutStore.settingsDb).toBeUndefined();
    });
  });

  describe('getSettings', () => {
    it('should return settings from settingsDb', async () => {
      const settings = await service.getSettings();
      expect(mockJsonStore.settingsDb.read).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should return empty object when settingsDb is not available', async () => {
      const serviceWithoutDb = new DevOpsService(mockTelemetryClient, {
        credentialService: mockCredentialService,
      });
      const settings = await serviceWithoutDb.getSettings();
      expect(settings).toEqual({});
    });
  });

  describe('getCredentials', () => {
    it('should return username and pat from credentialService', async () => {
      const credentials = await service.getCredentials();
      expect(mockCredentialService.getAzureDevOpsUsername).toHaveBeenCalled();
      expect(mockCredentialService.getAzureDevOpsPat).toHaveBeenCalled();
      expect(credentials).toEqual({ username: 'testuser', pat: 'test-pat-token' });
    });

    it('should throw error when credentialService is not provided', async () => {
      const serviceWithoutCreds = new DevOpsService(mockTelemetryClient, {
        jsonStore: mockJsonStore,
      });
      await expect(serviceWithoutCreds.getCredentials()).rejects.toThrow(
        'credentialService not provided'
      );
    });
  });

  describe('getAzureDevOpsConfig', () => {
    it('should return org, project, and apiVersion from settings', async () => {
      const config = await service.getAzureDevOpsConfig();
      expect(config).toEqual({
        org: 'test-org',
        project: 'test-project',
        apiVersion: '7.0',
      });
    });

    it('should return defaults when settings are empty', async () => {
      mockJsonStore.settingsDb.read.mockResolvedValue({});
      const config = await service.getAzureDevOpsConfig();
      expect(config).toEqual({
        org: '',
        project: '',
        apiVersion: '6.1',
      });
    });

    it('should return defaults when azureDevOps section is missing', async () => {
      mockJsonStore.settingsDb.read.mockResolvedValue({ other: 'data' });
      const config = await service.getAzureDevOpsConfig();
      expect(config).toEqual({
        org: '',
        project: '',
        apiVersion: '6.1',
      });
    });
  });

  describe('getEncodedCredentials', () => {
    it('should encode credentials to base64', () => {
      const encoded = service.getEncodedCredentials('user', 'pat');
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('should handle empty username', () => {
      const encoded = service.getEncodedCredentials('', 'pat');
      expect(typeof encoded).toBe('string');
    });

    it('should produce consistent output for same input', () => {
      const encoded1 = service.getEncodedCredentials('user', 'pat');
      const encoded2 = service.getEncodedCredentials('user', 'pat');
      expect(encoded1).toBe(encoded2);
    });
  });

  describe('validateCredentials', () => {
    it('should return valid:true for successful 200 response', async () => {
      axios.request.mockResolvedValue({ status: 200, data: { count: 1 } });

      const result = await service.validateCredentials({
        org: 'test-org',
        username: 'user',
        pat: 'valid-pat',
      });

      expect(result).toEqual({ valid: true });
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('test-org/_apis/projects'),
        })
      );
    });

    it('should return error when org is missing', async () => {
      const result = await service.validateCredentials({ pat: 'token' });
      expect(result).toEqual({ valid: false, error: 'Organization and PAT are required' });
      expect(axios.request).not.toHaveBeenCalled();
    });

    it('should return error when pat is missing', async () => {
      const result = await service.validateCredentials({ org: 'test-org' });
      expect(result).toEqual({ valid: false, error: 'Organization and PAT are required' });
    });

    it('should return invalid:error for 401 response', async () => {
      axios.request.mockRejectedValue({ response: { status: 401 } });

      const result = await service.validateCredentials({
        org: 'test-org',
        pat: 'invalid-pat',
      });

      expect(result).toEqual({ valid: false, error: 'Invalid or expired PAT' });
    });

    it('should return invalid:error for 403 response', async () => {
      axios.request.mockRejectedValue({ response: { status: 403 } });

      const result = await service.validateCredentials({
        org: 'test-org',
        pat: 'limited-pat',
      });

      expect(result).toEqual({ valid: false, error: 'PAT lacks required permissions' });
    });

    it('should return invalid:error for 404 response', async () => {
      axios.request.mockRejectedValue({ response: { status: 404 } });

      const result = await service.validateCredentials({
        org: 'nonexistent-org',
        pat: 'valid-pat',
      });

      expect(result).toEqual({ valid: false, error: 'Organization not found' });
    });

    it('should return invalid:error for other status codes', async () => {
      axios.request.mockRejectedValue({ response: { status: 500 } });

      const result = await service.validateCredentials({
        org: 'test-org',
        pat: 'valid-pat',
      });

      expect(result).toEqual({ valid: false, error: 'API error: 500' });
    });

    it('should handle connection errors', async () => {
      axios.request.mockRejectedValue({ code: 'ENOTFOUND' });

      const result = await service.validateCredentials({
        org: 'test-org',
        pat: 'valid-pat',
      });

      expect(result).toEqual({ valid: false, error: 'Unable to connect to Azure DevOps' });
    });

    it('should handle ECONNREFUSED errors', async () => {
      axios.request.mockRejectedValue({ code: 'ECONNREFUSED' });

      const result = await service.validateCredentials({
        org: 'test-org',
        pat: 'valid-pat',
      });

      expect(result).toEqual({ valid: false, error: 'Unable to connect to Azure DevOps' });
    });

    it('should handle generic errors', async () => {
      axios.request.mockRejectedValue(new Error('Network timeout'));

      const result = await service.validateCredentials({
        org: 'test-org',
        pat: 'valid-pat',
      });

      expect(result).toEqual({ valid: false, error: 'Network timeout' });
    });

    it('should use provided apiVersion', async () => {
      axios.request.mockResolvedValue({ status: 200, data: {} });

      await service.validateCredentials({
        org: 'test-org',
        pat: 'valid-pat',
        apiVersion: '7.1',
      });

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('api-version=7.1'),
        })
      );
    });

    it('should pass signal to axios request', async () => {
      const controller = new AbortController();
      axios.request.mockResolvedValue({ status: 200, data: {} });

      await service.validateCredentials(
        { org: 'test-org', pat: 'valid-pat' },
        { signal: controller.signal }
      );

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('addIssues', () => {
    const mockIssue = {
      'System.Title': 'Test Issue',
      'System.Description': 'Test Description',
    };

    it('should create work items successfully', async () => {
      const mockResponse = { status: 200, data: { id: 123 } };
      axios.request.mockResolvedValue(mockResponse);

      const result = await service.addIssues([mockIssue]);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('test-org/test-project/_apis/wit/workitems/$Issue'),
          headers: expect.objectContaining({
            'Content-Type': 'application/json-patch+json',
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
      expect(result.data).toEqual({ id: 123 });
    });

    it('should process multiple issues', async () => {
      const mockResponse = { status: 200, data: { id: 123 } };
      axios.request.mockResolvedValue(mockResponse);

      await service.addIssues([mockIssue, mockIssue]);

      expect(axios.request).toHaveBeenCalledTimes(2);
    });

    it('should throw when axios rejects', async () => {
      const mockError = new Error('Network error');
      axios.request.mockRejectedValue(mockError);

      await expect(service.addIssues([mockIssue])).rejects.toThrow('Network error');
    });

    it('should pass signal to axios request', async () => {
      const controller = new AbortController();
      axios.request.mockResolvedValue({ status: 200, data: {} });

      await service.addIssues([mockIssue], { signal: controller.signal });

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should throw AbortError when signal is aborted before processing', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(service.addIssues([mockIssue], { signal: controller.signal })).rejects.toThrow(
        'Aborted'
      );
    });

    it('should track telemetry on success', async () => {
      axios.request.mockResolvedValue({ status: 200, data: { id: 123 } });

      await service.addIssues([mockIssue]);

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DevOpsService.Response',
        })
      );
    });
  });

  describe('getWorkItemByUrl', () => {
    const testUrl = 'https://dev.azure.com/test-org/_apis/wit/workitems/123';

    it('should fetch work item successfully', async () => {
      const mockResponse = { status: 200, data: { id: 123, fields: {} } };
      axios.request.mockResolvedValue(mockResponse);

      const result = await service.getWorkItemByUrl(testUrl);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: testUrl,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
      expect(result.data).toEqual({ id: 123, fields: {} });
    });

    it('should pass signal to axios request', async () => {
      const controller = new AbortController();
      axios.request.mockResolvedValue({ status: 200, data: {} });

      await service.getWorkItemByUrl(testUrl, { signal: controller.signal });

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should throw on API error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('API Error');
      axios.request.mockRejectedValue(error);

      await expect(service.getWorkItemByUrl(testUrl)).rejects.toThrow('API Error');
      consoleSpy.mockRestore();
    });

    it('should track telemetry on success', async () => {
      axios.request.mockResolvedValue({ status: 200, data: { id: 123 } });

      await service.getWorkItemByUrl(testUrl);

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalled();
    });
  });

  describe('searchWorkItemByIssueId', () => {
    it('should search for work items by issue ID', async () => {
      const mockResponse = { status: 200, data: { workItems: [{ id: 123 }] } };
      axios.request.mockResolvedValue(mockResponse);

      const result = await service.searchWorkItemByIssueId('GH-12345');

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('test-org/test-project/_apis/wit/wiql'),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          data: expect.stringContaining('GH-12345'),
        })
      );
      expect(result.data.workItems).toHaveLength(1);
    });

    it('should pass signal to axios request', async () => {
      const controller = new AbortController();
      axios.request.mockResolvedValue({ status: 200, data: { workItems: [] } });

      await service.searchWorkItemByIssueId('GH-12345', { signal: controller.signal });

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('API Error');
      axios.request.mockRejectedValue(error);

      const result = await service.searchWorkItemByIssueId('GH-12345');

      expect(result).toBeInstanceOf(Error);
      consoleSpy.mockRestore();
    });

    it('should track telemetry on success', async () => {
      axios.request.mockResolvedValue({ status: 200, data: { workItems: [{ id: 1 }, { id: 2 }] } });

      await service.searchWorkItemByIssueId('GH-12345');

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DevOpsService.Response',
        })
      );
    });
  });

  describe('abort signal handling', () => {
    it('should abort addIssues when signal is aborted mid-processing', async () => {
      const controller = new AbortController();
      let callCount = 0;

      axios.request.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          controller.abort();
        }
        return { status: 200, data: { id: callCount } };
      });

      const issues = [
        { 'System.Title': 'Issue 1' },
        { 'System.Title': 'Issue 2' },
      ];

      await expect(service.addIssues(issues, { signal: controller.signal })).rejects.toThrow(
        'Aborted'
      );
    });
  });

  describe('logAndTrackResponse', () => {
    it('should track event with correct measurements for array items', () => {
      service.logAndTrackResponse([{ id: 1 }, { id: 2 }], 'testSource');

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith({
        name: 'DevOpsService.Response',
        measurements: {
          'DevOpsService.EventType': 'testSource',
          'DevOpsService.LastRun': expect.any(String),
          'DevOpsService.Issues': 2,
        },
      });
    });

    it('should track event with count 1 for non-array items', () => {
      service.logAndTrackResponse({ id: 1 }, 'testSource');

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          measurements: expect.objectContaining({
            'DevOpsService.Issues': 1,
          }),
        })
      );
    });

    it('should not track when telemetryClient is not provided', () => {
      const serviceWithoutTelemetry = new DevOpsService(null, {
        jsonStore: mockJsonStore,
        credentialService: mockCredentialService,
      });

      serviceWithoutTelemetry.logAndTrackResponse([{ id: 1 }], 'testSource');

      expect(mockTelemetryClient.trackEvent).not.toHaveBeenCalled();
    });
  });

  describe('getAssignedIssues', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should query for work items in specific states', async () => {
      const workItemsResponse = {
        data: {
          workItems: [{ id: 101 }, { id: 102 }],
        },
      };
      const detailsResponse = {
        data: {
          value: [
            { id: 101, fields: { 'System.Title': 'Issue 1', 'Custom.IssueId': 'GH-1' } },
            { id: 102, fields: { 'System.Title': 'Issue 2', 'Custom.IssueId': 'GH-2' } },
          ],
        },
      };

      axios.post.mockResolvedValue(workItemsResponse);
      axios.get.mockResolvedValue(detailsResponse);

      const result = await service.getAssignedIssues();

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('test-org/test-project/_apis/wit/wiql'),
        expect.objectContaining({
          query: expect.stringContaining("System.State] IN ('To Do','Waiting on Customer'"),
        }),
        expect.any(Object)
      );
      expect(result).toEqual(detailsResponse.data.value);
    });

    it('should fetch work item details with correct fields', async () => {
      axios.post.mockResolvedValue({
        data: { workItems: [{ id: 101 }] },
      });
      axios.get.mockResolvedValue({
        data: { value: [{ id: 101 }] },
      });

      await service.getAssignedIssues();

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('ids=101&fields=System.Id,System.Title,Custom.IssueId'),
        expect.objectContaining({
          auth: { username: 'testuser', password: 'test-pat-token' },
        })
      );
    });

    it('should pass signal to both API calls', async () => {
      const controller = new AbortController();
      axios.post.mockResolvedValue({
        data: { workItems: [{ id: 101 }] },
      });
      axios.get.mockResolvedValue({
        data: { value: [{ id: 101 }] },
      });

      await service.getAssignedIssues({ signal: controller.signal });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ signal: controller.signal })
      );
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal })
      );
    });

    it('should throw error on API failure', async () => {
      const apiError = new Error('API failed');
      axios.post.mockRejectedValue(apiError);

      await expect(service.getAssignedIssues()).rejects.toThrow('API failed');
    });

    it('should throw error on details API failure', async () => {
      axios.post.mockResolvedValue({
        data: { workItems: [{ id: 101 }] },
      });
      axios.get.mockRejectedValue(new Error('Details API failed'));

      await expect(service.getAssignedIssues()).rejects.toThrow('Details API failed');
    });

    it('should track telemetry on success', async () => {
      axios.post.mockResolvedValue({
        data: { workItems: [{ id: 101 }] },
      });
      axios.get.mockResolvedValue({
        data: { value: [{ id: 101 }] },
      });

      await service.getAssignedIssues();

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DevOpsService.Response',
          measurements: expect.objectContaining({
            'DevOpsService.EventType': 'getAssignedIssues',
          }),
        })
      );
    });
  });

});
