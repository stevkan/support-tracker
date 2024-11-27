import axios from 'axios';
import chalk from 'chalk';
import { InvalidArgumentError } from 'commander';

import { jsonStore } from './store/jsonStore.js';

/**
 * Represents an error handler.
 * @class
 */
class ErrorHandler {
  constructor(telemetryClient) {
    this.telemetryClient = telemetryClient;
    this.logging = jsonStore.loggingDb.read();
  }

  /**
 * Handles errors that occur in the application, logging them to the console and sending telemetry data.
 *
 * @param { Error } error - The error object to be handled.
 * @param { string } serviceName - The name of the service where the error occurred.
 * @param { object } telemetry - An object with a `trackException` method to send telemetry data.
 */
  async errorHandler(error, serviceName) {
    if (error.response && error.response.status && error.reponse.status === 429) {
      console.log('429 error');
      return error.response
    }
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
    } else if (error instanceof InvalidArgumentError) {
      console.error(chalk.red(`Unexpected error: ${ stack }`));
      error.name = 'Unknown';
    } else if (error instanceof Error && serviceName) {
      console.error(chalk.red(`Unexpected error in ${ serviceName }: ${ stack }`));
      error.name = serviceName;
    } else {
      console.error(chalk.red(`Unexpected error: ${ stack }`));
      error.name = 'Unknown';
    }
    
    // console.log('logs ', await this.logging);
    const logs = await this.logging;
    logs.push({ stack });
    // await jsonStore.loggingDb.update(null, logs);
    await jsonStore.loggingDb.write(logs);
    
    this.telemetryClient.trackException({
      exception: error,
      measurements: { service: serviceName },
      severity: 3,
    });
    
    return error;
  };
}

export { ErrorHandler };