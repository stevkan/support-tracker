import axios from 'axios';
import chalk from 'chalk';

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
  errorHandler(error, serviceName) {
    if (error instanceof axios.AxiosError) {
      console.error(chalk.red(`API request failed in ${ serviceName }:  ${ error.stack }`));
    } else if (error instanceof TypeError) {
      console.error(chalk.red(`Type error in ${ serviceName }:  ${ error.stack }`));
    } else if (error instanceof ReferenceError) {
      console.error(chalk.red(`Reference error in ${ serviceName }:  ${ error.stack }`));
    } else {
      console.error(chalk.red(`Unexpected error in ${ serviceName }:  ${ error.stack }`));
    }
    
    this.telemetryClient.trackException({
      exception: error,
      measurements: { service: serviceName },
      severity: 3,
    });
    
    process.exit(1);
  };
}

export { ErrorHandler };