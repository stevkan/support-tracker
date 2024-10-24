import dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';

import { TelemetryClient } from './telemetryClient.js';
import { sleep } from './utils.js';
import { jsonStore } from './store/jsonStore.js';
import { DevOpsService, GitHubService, InternalStackOverflowService, StackOverflowService } from './services/index.js';
import { GitHub, InternalStackOverflow, StackOverflow } from './config.js';
import { generateIndexHtml } from './createIndex.js';
import { ErrorHandler } from './errorHandler.js';

dotenv.config(process.env);

/**
 * Environment variables used to configure the application.
 * 
 * @property {number} NUMBER_OF_DAYS_TO_BACK_QUERY - The number of days to go back when querying data.
 * @property {number} TIME_OF_DAY_TO_QUERY_FROM - The time of day to start querying data.
 */
const {
  USE_TEST_DATA,
  NUMBER_OF_DAYS_TO_BACK_QUERY,
  TIME_OF_DAY_TO_QUERY_FROM
} = process.env;

// // Get node arguments.
// const args = process.argv.slice(2);
// const [commands] = args;
// const [NumberOfDaysToQuery] = args.slice(0);
// const [StartTimeOfQuery] = args.slice(1);
// const [AzureDevOpsPat] = args.slice(2);
// const [UseTestData] = args.slice(3);

// if (commands === '--help' || commands === '-h') {
//   console.log('Usage: node index.js <<NumberOfDaysToQuery>> <<StartTimeOfQuery>> <<AzureDevOpsPat>> <<UseTestData>>');
//   process.exit(0);
// }

// const queryNumberOfDays = NumberOfDaysToQuery ? Number(NumberOfDaysToQuery) : 1;
// const queryStartTime = StartTimeOfQuery ? Number(StartTimeOfQuery) : 11;
// const personalAccessToken = AzureDevOpsPat ? AzureDevOpsPat : '';
// const shouldUseTestData = UseTestData ? UseTestData : false;

// console.log(queryNumberOfDays, queryStartTime, personalAccessToken, shouldUseTestData);

const useTestData = USE_TEST_DATA === 'true' ? true : false;

// Initialize the error handler.
const errorHandler = new ErrorHandler();

// Initialize the telemetry client.
const telemetryClient = new TelemetryClient();

// Initialize the DevOps service.
const devOpsService = new DevOpsService(telemetryClient);

try {
  (async () => {

    if (!!useTestData) console.error(chalk.greenBright.underline.bold('### RUNNING IN DEVELOPMENT MODE ###'));

    let queryDate = new Date();
    queryDate.setDate(queryDate.getDate()-NUMBER_OF_DAYS_TO_BACK_QUERY);
    const timeOfDayToQueryFrom = Number(TIME_OF_DAY_TO_QUERY_FROM);
    queryDate.setHours(timeOfDayToQueryFrom, 0, 0, 0);
    queryDate = new Date(queryDate.toUTCString());
  
    // Calling sleep is necessary to ensure parameters are set before calling the services.
    await sleep(1000);
  
    /**
     * Initializes the StackOverflowService, InternalStackOverflowService, and GitHubService with the necessary configuration and dependencies.
     * 
     * The StackOverflowService is responsible for retrieving and processing data from the public StackOverflow API.
     * The InternalStackOverflowService is responsible for retrieving and processing data from the internal StackOverflow API.
     * The GitHubService is responsible for retrieving and processing data from the GitHub API.
     * 
     * These services are used to gather data from various sources that are then processed and integrated into the application.
     * 
     * @param {Object} StackOverflow - The configuration object for the StackOverflow API.
     * @param {Object} InternalStackOverflow - The configuration object for the internal StackOverflow API.
     * @param {Object} GitHub - The configuration object for the GitHub API.
     * @param {Date} queryDate - The date used to query the data sources.
     */
    const stackOverflowService = new StackOverflowService(StackOverflow, queryDate, telemetryClient);
    const internalStackOverflowService = new InternalStackOverflowService(InternalStackOverflow, queryDate, telemetryClient);
    const gitHubService = new GitHubService(GitHub, queryDate, telemetryClient);
  
    const startTime = new Date();
    startTime.setDate(startTime.getDate());
    const localStartTime = startTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    console.info(chalk.green.bold(`Starting Processes: ${ localStartTime }`));
    telemetryClient.trackEvent({ name: "Starting Processes", measurements: { date: startTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) } });

    jsonStore.issuesDb.data.index.startTime = localStartTime;
    await jsonStore.issuesDb.write();
  
    /**
     * Processes the data from the StackOverflow and GitHub services.
     * 
     * This code is part of the main application logic that orchestrates the data retrieval and processing from various services.
     */
    console.group(chalk.rgb(244, 128, 36).bold('\nProcessing StackOverflow...'))
    await stackOverflowService.process().then(res => handleServiceResponse(res));
    console.groupEnd();
    
    console.log(chalk.greenBright.bold('\n----------------------------------------------------------------------------------------------------------'));
    
    console.group(chalk.rgb(255, 176, 37).bold('\nProcessing Internal StackOverflow...'))
    await internalStackOverflowService.process().then(res => handleServiceResponse(res));
    console.groupEnd();
    
    console.log(chalk.greenBright.bold('\n----------------------------------------------------------------------------------------------------------'));
    
    console.group(chalk.blue.bold('\nProcessing GitHub...'))
    await gitHubService.process().then(res => handleServiceResponse(res));
    console.groupEnd();

    await new Promise(async (resolve) => {
      const endTime = new Date();
      endTime.setDate(endTime.getDate());
      const localEndTime = endTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      console.info(chalk.green.bold(`\nFinished Processes: ${ localEndTime }`));
      telemetryClient.trackEvent({ name: "Finished Processes", measurements: { date: endTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) } });

      jsonStore.issuesDb.data.index.endTime = localEndTime;
      await jsonStore.issuesDb.write();
      await generateIndexHtml(jsonStore.issuesDb.data);

      sleep(1500).then(() => {
        telemetryClient.flushClient();
        resolve();
        process.exit();
      });
    });
  })();
} catch (error) {
  devOpsService.errorHandler(error);
}

const handleServiceResponse = (res) => {
  if (res instanceof axios.AxiosError || res instanceof Error) {
    const error = res;
    const statusHeader = chalk.green.italic('Process status: ');
    switch (error.status) {
      case 400:
        console.error(statusHeader + chalk.red.italic(`Bad request in ${ error.name }: Received ${ error.status }. Check your parameters.`));
        break;
      case 401:
        console.error(statusHeader + chalk.red.italic(`Unauthorized in ${ error.name }: Received ${ error.status }. Check your credentials.`));
        break;
      case 403:
        console.error(statusHeader + chalk.red.italic(`Forbidden in ${ error.name }: Received ${ error.status }. Check your permissions.`));
        break;
      case 404:
        console.error(statusHeader + chalk.red.italic(`Not found in ${ error.name }: Received ${ error.status }. Check your URL.`));
        break;
      case 429:
        console.error(statusHeader + chalk.red.italic(`Too many requests in ${ error.name }: Received ${ error.status }. Check your rate limits.`));
        break;
      case 500:
        console.error(statusHeader + chalk.red.italic(`Internal server error in ${ error.name }: Received ${ error.status }. Check the server.`));
        break;
      default:
        console.error(statusHeader + chalk.red.italic(`Service returned an unexpected error: ${error.message}. Check the server.`));
        break;
    };
  }
  switch (res.status) {
    case 200:
    case 204:
      if (!!res.message) {
        console.warn(chalk.green.italic('Process status:'), 
          chalk.red.italic(res.message));
      }
      break;
  }
};