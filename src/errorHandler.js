import axios from 'axios';
import chalk from 'chalk';

import { jsonStore } from './store/jsonStore.js';

/**
 * Represents an error handler.
 * @class
 */
class ErrorHandler {
  constructor(telemetryClient) {
    this.telemetryClient = telemetryClient;
  }

  /**
 * Handles errors that occur in the application, logging them to the console and sending telemetry data.
 *
 * @param { Error } error - The error object to be handled.
 * @param { string } serviceName - The name of the service where the error occurred.
 * @param { object } telemetry - An object with a `trackException` method to send telemetry data.
 */
  async errorHandler(error, serviceName) {
    const { status, message, stack } = error;
    if (error instanceof axios.AxiosError) {
      console.error(chalk.red(`API error in ${ serviceName }: ${ stack }`));
      error.name = serviceName;
    } else if (error instanceof TypeError) {
      console.error(chalk.red(`Type error in ${ serviceName }: ${ stack }`));
      error.name = serviceName;
    } else if (error instanceof ReferenceError) {
      console.error(chalk.red(`Reference error in ${ serviceName }: ${ stack }`));
      error.name = serviceName;
    } else if (error instanceof Error && serviceName) {
      console.error(chalk.red(`Unexpected error in ${ serviceName }: ${ stack }`));
      error.name = serviceName;
    } else {
      console.error(chalk.red(`Unexpected error: ${ stack }`));
      error.name = 'Unknown';
    }
    
    jsonStore.loggingDb.data.logs.push({ stack });
    await jsonStore.loggingDb.write();
    
    this.telemetryClient.trackException({
      exception: error,
      measurements: { service: serviceName },
      severity: 3,
    });
    
    return error;
    
    // process.exit(1);
  };
}

export { ErrorHandler };