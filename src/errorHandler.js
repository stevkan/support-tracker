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
    // if (error.response && error.response.status && error.reponse.status === 429) {
    //   console.log('429 error');
    //   return error.response
    // }
    const { status, message, stack } = error;
    if (error instanceof axios.AxiosError) {
      console.error(chalk.red(`API error in ${ serviceName }: ${ stack }`));
      error.name = serviceName;
      console.log('AXIOS ERROR ', error)
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

  handleServiceResponse (res, serviceName) {
    const statusHeader = chalk.green.bold('Process status: ');
    switch (res.status) {
      case 200:
      case 204:
        break;
      case 400:
        console.error(statusHeader + chalk.red.bold(`Bad request in ${ res.name }: Received ${ res.status }. Check your parameters.`));
        res = this.errorHandler(res, serviceName);
        break;
      case 401:
        console.error(statusHeader + chalk.red.bold(`Unauthorized in ${ res.name }: Received ${ res.status }. Check your credentials.`));
        res = this.errorHandler(res, serviceName);
        break;
      case 403:
        console.error(statusHeader + chalk.red.bold(`Forbidden in ${ res.name }: Received ${ res.status }. Check your permissions.`));
        res = this.errorHandler(res, serviceName);
        break;
      case 404:
        console.error(statusHeader + chalk.red.bold(`Not found in ${ res.name }: Received ${ res.status }. Check your URL.`));
        res = this.errorHandler(res, serviceName);
        break;
      case 429:
        console.error(statusHeader + chalk.red.bold(`Too many requests in ${ res.name }: Received ${ res.status }. Check your rate limits.`));
        res = this.errorHandler(res, serviceName);
        break;
      case 500:
        console.error(statusHeader + chalk.red.bold(`Internal server error in ${ res.name }: Received ${ res.status }. Check the server.`));
        res = this.errorHandler(res, serviceName);
        break;
      default:
        console.log('RES ', res)
        console.error(statusHeader + chalk.red.bold(`Service returned an unexpected error: ${res.message}. Check the server.`));
        res = this.errorHandler(res, serviceName);
        break;
    };
    return res;
  }
}

export { ErrorHandler };