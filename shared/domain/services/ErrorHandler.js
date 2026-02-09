import axios from 'axios';

/**
 * Base error handler class for services.
 * Accepts dependencies via constructor to avoid direct imports.
 */
class ErrorHandler {
  constructor(telemetryClient, deps = {}) {
    this.telemetryClient = telemetryClient;
    this.jsonStore = deps.jsonStore;
    this.loggingDb = deps.jsonStore?.loggingDb;
  }

  async errorHandler(error, serviceName) {
    const { stack } = error;

    if (error instanceof axios.AxiosError) {
      console.error(`API error in ${serviceName}: ${stack}`);
      error.name = serviceName;
    } else if (error instanceof TypeError) {
      console.error(`Type error in ${serviceName}: ${stack}`);
      error.name = serviceName;
    } else if (error instanceof ReferenceError) {
      console.error(`Reference error in ${serviceName}: ${stack}`);
      error.name = serviceName;
    } else if (error instanceof Error && serviceName) {
      console.error(`Unexpected error in ${serviceName}: ${stack}`);
      error.name = serviceName;
    } else {
      console.error(`Unexpected error: ${stack}`);
      error.name = 'Unknown';
    }

    if (this.loggingDb) {
      try {
        const logs = await this.loggingDb.read();
        logs.push({ stack, timestamp: new Date().toISOString() });
        await this.loggingDb.write(logs);
      } catch (e) {
        console.error('Failed to write to logging db:', e);
      }
    }

    if (this.telemetryClient) {
      this.telemetryClient.trackException({
        exception: error,
        measurements: { service: serviceName },
        severity: 3,
      });
    }

    return error;
  }

  async handleServiceResponse(res, serviceName) {
    switch (res.status) {
      case 200:
      case 204:
        break;
      case 400:
        console.error(`Bad request in ${serviceName}: Received ${res.status}`);
        return await this.errorHandler(new Error(`${serviceName} HTTP ${res.status}`), serviceName);
      case 401:
        console.error(`Unauthorized in ${serviceName}: Received ${res.status}`);
        return await this.errorHandler(new Error(`${serviceName} HTTP ${res.status}`), serviceName);
      case 403:
        console.error(`Forbidden in ${serviceName}: Received ${res.status}`);
        return await this.errorHandler(new Error(`${serviceName} HTTP ${res.status}`), serviceName);
      case 404:
        console.error(`Not found in ${serviceName}: Received ${res.status}`);
        return await this.errorHandler(new Error(`${serviceName} HTTP ${res.status}`), serviceName);
      case 429:
        console.error(`Too many requests in ${serviceName}: Received ${res.status}`);
        return await this.errorHandler(new Error(`${serviceName} HTTP ${res.status}`), serviceName);
      case 500:
        console.error(`Internal server error in ${serviceName}: Received ${res.status}`);
        return await this.errorHandler(new Error(`${serviceName} HTTP ${res.status}`), serviceName);
      default:
        if (res.status >= 400) {
          console.error(`Unexpected error in ${serviceName}: ${res.status}`);
          return await this.errorHandler(new Error(`${serviceName} HTTP ${res.status}`), serviceName);
        }
        break;
    }
    return res;
  }
}

export { ErrorHandler };
