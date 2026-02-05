import axios from 'axios';
import { ErrorHandler } from '../../../../../shared/domain/services/ErrorHandler.js';

describe('ErrorHandler', () => {
  let errorHandler;
  let mockTelemetryClient;
  let mockLoggingDb;
  let consoleErrorSpy;

  beforeEach(() => {
    mockTelemetryClient = {
      trackException: vi.fn(),
    };
    mockLoggingDb = {
      read: vi.fn().mockResolvedValue([]),
      write: vi.fn().mockResolvedValue(undefined),
    };
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler = new ErrorHandler(mockTelemetryClient, { jsonStore: { loggingDb: mockLoggingDb } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('stores telemetryClient', () => {
      const handler = new ErrorHandler(mockTelemetryClient);
      expect(handler.telemetryClient).toBe(mockTelemetryClient);
    });

    it('stores jsonStore from deps', () => {
      const jsonStore = { get: vi.fn() };
      const handler = new ErrorHandler(null, { jsonStore });
      expect(handler.jsonStore).toBe(jsonStore);
    });

    it('stores loggingDb from deps.jsonStore', () => {
      const handler = new ErrorHandler(null, { jsonStore: { loggingDb: mockLoggingDb } });
      expect(handler.loggingDb).toBe(mockLoggingDb);
    });

    it('handles missing deps', () => {
      const handler = new ErrorHandler(null);
      expect(handler.jsonStore).toBeUndefined();
      expect(handler.loggingDb).toBeUndefined();
    });
  });

  describe('errorHandler', () => {
    describe('error type handling', () => {
      it('handles AxiosError', async () => {
        const axiosError = new axios.AxiosError('Network error');
        axiosError.stack = 'AxiosError stack trace';

        const result = await errorHandler.errorHandler(axiosError, 'TestService');

        expect(result.name).toBe('TestService');
        expect(consoleErrorSpy).toHaveBeenCalledWith('API error in TestService: AxiosError stack trace');
      });

      it('handles TypeError', async () => {
        const typeError = new TypeError('Cannot read property');
        typeError.stack = 'TypeError stack trace';

        const result = await errorHandler.errorHandler(typeError, 'TestService');

        expect(result.name).toBe('TestService');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Type error in TestService: TypeError stack trace');
      });

      it('handles ReferenceError', async () => {
        const refError = new ReferenceError('x is not defined');
        refError.stack = 'ReferenceError stack trace';

        const result = await errorHandler.errorHandler(refError, 'TestService');

        expect(result.name).toBe('TestService');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Reference error in TestService: ReferenceError stack trace');
      });

      it('handles generic Error with serviceName', async () => {
        const genericError = new Error('Something went wrong');
        genericError.stack = 'Error stack trace';

        const result = await errorHandler.errorHandler(genericError, 'TestService');

        expect(result.name).toBe('TestService');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error in TestService: Error stack trace');
      });

      it('handles error without serviceName', async () => {
        const genericError = new Error('Something went wrong');
        genericError.stack = 'Error stack trace';

        const result = await errorHandler.errorHandler(genericError, null);

        expect(result.name).toBe('Unknown');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error: Error stack trace');
      });

      it('handles non-Error objects', async () => {
        const nonError = { stack: 'custom stack' };

        const result = await errorHandler.errorHandler(nonError, 'TestService');

        expect(result.name).toBe('Unknown');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error: custom stack');
      });
    });

    describe('logging database', () => {
      it('writes to loggingDb when available', async () => {
        const error = new Error('test');
        error.stack = 'test stack';

        await errorHandler.errorHandler(error, 'TestService');

        expect(mockLoggingDb.read).toHaveBeenCalled();
        expect(mockLoggingDb.write).toHaveBeenCalledWith([
          expect.objectContaining({
            stack: 'test stack',
            timestamp: expect.any(String),
          }),
        ]);
      });

      it('appends to existing logs', async () => {
        mockLoggingDb.read.mockResolvedValue([{ stack: 'old', timestamp: '2024-01-01' }]);
        const error = new Error('test');
        error.stack = 'new stack';

        await errorHandler.errorHandler(error, 'TestService');

        expect(mockLoggingDb.write).toHaveBeenCalledWith([
          { stack: 'old', timestamp: '2024-01-01' },
          expect.objectContaining({ stack: 'new stack' }),
        ]);
      });

      it('handles loggingDb read failure', async () => {
        mockLoggingDb.read.mockRejectedValue(new Error('Read failed'));
        const error = new Error('test');
        error.stack = 'test stack';

        const result = await errorHandler.errorHandler(error, 'TestService');

        expect(result).toBe(error);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to write to logging db:', expect.any(Error));
      });

      it('handles loggingDb write failure', async () => {
        mockLoggingDb.write.mockRejectedValue(new Error('Write failed'));
        const error = new Error('test');
        error.stack = 'test stack';

        const result = await errorHandler.errorHandler(error, 'TestService');

        expect(result).toBe(error);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to write to logging db:', expect.any(Error));
      });

      it('skips logging when loggingDb is not available', async () => {
        const handler = new ErrorHandler(mockTelemetryClient, { jsonStore: {} });
        const error = new Error('test');

        await handler.errorHandler(error, 'TestService');

        expect(mockLoggingDb.read).not.toHaveBeenCalled();
      });
    });

    describe('telemetry', () => {
      it('tracks exception with telemetryClient', async () => {
        const error = new Error('test');
        error.stack = 'test stack';

        await errorHandler.errorHandler(error, 'TestService');

        expect(mockTelemetryClient.trackException).toHaveBeenCalledWith({
          exception: error,
          measurements: { service: 'TestService' },
          severity: 3,
        });
      });

      it('skips telemetry when telemetryClient is not available', async () => {
        const handler = new ErrorHandler(null, { jsonStore: { loggingDb: mockLoggingDb } });
        const error = new Error('test');

        await handler.errorHandler(error, 'TestService');

        expect(mockTelemetryClient.trackException).not.toHaveBeenCalled();
      });
    });

    describe('return value', () => {
      it('returns the original error', async () => {
        const error = new Error('test');

        const result = await errorHandler.errorHandler(error, 'TestService');

        expect(result).toBe(error);
      });
    });
  });

  describe('handleServiceResponse', () => {
    describe('success responses', () => {
      it('returns response for status 200', () => {
        const res = { status: 200, data: 'success' };

        const result = errorHandler.handleServiceResponse(res, 'TestService');

        expect(result).toBe(res);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('returns response for status 204', () => {
        const res = { status: 204 };

        const result = errorHandler.handleServiceResponse(res, 'TestService');

        expect(result).toBe(res);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    describe('error responses', () => {
      it('handles 400 Bad Request', () => {
        const res = { status: 400 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Bad request in TestService: Received 400');
      });

      it('handles 401 Unauthorized', () => {
        const res = { status: 401 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Unauthorized in TestService: Received 401');
      });

      it('handles 403 Forbidden', () => {
        const res = { status: 403 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Forbidden in TestService: Received 403');
      });

      it('handles 404 Not Found', () => {
        const res = { status: 404 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Not found in TestService: Received 404');
      });

      it('handles 429 Too Many Requests', () => {
        const res = { status: 429 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Too many requests in TestService: Received 429');
      });

      it('handles 500 Internal Server Error', () => {
        const res = { status: 500 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Internal server error in TestService: Received 500');
      });

      it('handles other 4xx errors', () => {
        const res = { status: 422 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error in TestService: 422');
      });

      it('handles other 5xx errors', () => {
        const res = { status: 503 };

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error in TestService: 503');
      });
    });

    describe('non-error responses', () => {
      it('returns response for status 201', () => {
        const res = { status: 201, data: 'created' };

        const result = errorHandler.handleServiceResponse(res, 'TestService');

        expect(result).toBe(res);
      });

      it('returns response for status 301', () => {
        const res = { status: 301 };

        const result = errorHandler.handleServiceResponse(res, 'TestService');

        expect(result).toBe(res);
      });
    });

    describe('calls errorHandler for errors', () => {
      it('calls errorHandler for error responses', async () => {
        const res = { status: 500 };
        const errorHandlerSpy = vi.spyOn(errorHandler, 'errorHandler');

        errorHandler.handleServiceResponse(res, 'TestService');

        expect(errorHandlerSpy).toHaveBeenCalledWith(res, 'TestService');
      });
    });
  });
});
