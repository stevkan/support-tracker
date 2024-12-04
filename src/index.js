import dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';
import { Command, InvalidArgumentError } from 'commander';
import openBrowser from 'open-web-browser';

import { sleep } from './utils.js';
import { jsonStore } from './store/jsonStore.js';
import { TelemetryClient } from './telemetryClient.js';
import { DevOpsService, GitHubService, InternalStackOverflowService, StackOverflowService } from './services/index.js';
import { GitHub, InternalStackOverflow, StackOverflow } from './config.js';
import { generateIndexHtml } from './createIndex.js'

dotenv.config(process.env);

// Initialize the telemetry client.
const telemetryClient = new TelemetryClient();

// Initialize the DevOps service.
const devOpsService = new DevOpsService(telemetryClient);

const issuesDb = jsonStore.issuesDb;
const settingsDb = jsonStore.settingsDb;
const settings = settingsDb.read();

const program = new Command();

try {
  (async () => {

    program
      .name('support-tracker')
      .description('A CLI tool for tracking issues from Stack Overflow and GitHub.')
      .version('2.1.1')
      .showSuggestionAfterError(true)
      .usage('[command]')
      .action(async (str, options) => {
        if (options.args[0] === undefined) return
        else if (options.args[0] === 'help' && options.args[1] === undefined) program.help();
        else if (options.args[0] === 'help' && options.args[1] !== undefined) {
          switch (options.args[1]) {
            case 'get-params':
              program.command('help')
                .usage(' ')
                .addHelpOption(false)
                .argument('None', 'This command does not take any arguments.')
                .addHelpText('after', chalk.green(`\nExample: npm start get-params`))
                .help();
              break;
            case 'set-params':
              program.command('help')
                .usage('set-params')
                .addHelpOption(false)
                .argument('[number-of-days] [starting-hour]')
                .addHelpText('after', chalk.green(`\nExample: npm start set-params 7 11`))
                .help();
              break;
            case 'set-use-test-data':
              program.command('help')
                .usage('set-use-test-data')
                .addHelpOption(false)
                .argument('<<use-test-data>>', 'use test data flag')
                .addHelpText('after', chalk.green(`\nExample: npm start set-use-test-data true`))
                .help();
              break;
            case 'set-verbosity':
              program.command('help')
                .usage('set-verbosity')
                .addHelpOption(false)
                .argument('<<is-verbose>>', 'set verbosity flag')
                .addHelpText('after', chalk.green(`\nExample: npm start set-verbosity true`))
                .help();
              break;
            case 'set-username':
              program.command('help')
                .usage('set-username')
                .addHelpOption(false)
                .argument('<<username>>', 'Azure DevOps username')
                .addHelpText('after', chalk.green(`\nExample: npm start set-username <username>`))
                .help();
              break;
            case 'set-pat':
              program.command('help')
                .usage('set-pat')
                .addHelpOption(false)
                .argument('<<pat>>', 'Azure DevOps personal access token')
                .addHelpText('after', chalk.green(`\nExample: npm start set-pat <pat>`))
                .action(() => {
                  options.args[0] = '';
                })
                .help();
              break;
            default:
              return;
          }
        };
      });

    program.command('get-params')
      .description('Get the current parameters for the application.')
      .action(async (str, options) => {
          const { azureDevOpsUsername, azureDevOpsPat, isVerbose, useVerbosity, numberOfDaysToQuery, startTimeOfQuery } = settings;
          console.log(chalk.green(`Azure DevOps Username:`), chalk.white(`${ azureDevOpsUsername }`));
          console.log(chalk.green(`Azure DevOps PAT:`), chalk.white(`${ azureDevOpsPat }`));
          console.log(chalk.green(`Use Test Data:`), chalk.white(`${ isVerbose }`));
          console.log(chalk.green(`Is Verbose:`), chalk.white(`${ useVerbosity }`));
          console.log(chalk.green(`Number of Days to Query:`), chalk.white(`${ numberOfDaysToQuery }`));
          console.log(chalk.green(`Start Time of Query:`), chalk.white(`${ startTimeOfQuery }`));
          process.exit(0);
      })
      .helpOption(false)
      .addHelpOption(false)
      .helpCommand(false);

    program.command('set-params')
      .description('Set the number of days to query and the hour to query back to. [Default: 1 11]')
      .argument('[number-of-days]', 'number of days to query for issues', 1)
      .argument('[starting-hour]', 'hour of day to query for issues', 11)
      .action(async (numberOfDaysToQuery, startTimeOfQuery, options) => {
        if (isNaN(numberOfDaysToQuery) || numberOfDaysToQuery < 1) {
          const error = new InvalidArgumentError('Invalid or missing argument: <number-of-days>');
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        if (isNaN(startTimeOfQuery) || startTimeOfQuery < 1 || startTimeOfQuery > 23) {
          const error = new InvalidArgumentError('Invalid or missing argument: <starting-hour>');
          devOpsService.errorHandler(error);
          process.exit(1);
        }

        try {
          const days = Number(numberOfDaysToQuery) || (await settings).numberOfDaysToQuery;
          const time = Number(startTimeOfQuery) || (await settings).startTimeOfQuery;
          await settingsDb.update( 'numberOfDaysToQuery', days );
          await settingsDb.update( 'startTimeOfQuery', time );
        } catch (error) {
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        process.exit(0);
      })
      .helpOption(false)
      .addHelpOption(false)
      .helpCommand(false);

    function isValidJSON(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    }

    program.command('set-use-test-data')
      .description("Enables/disables the use of test data. [Default: false]")
      .argument('<use-test-data>', 'use test data flag')
      .action(async (useTestData, options) => {
        if (!isValidJSON(useTestData)) {
          const error = new InvalidArgumentError('Invalid or missing argument: <use-test-data>');
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        try {
          const willUseTestData = JSON.parse(useTestData) ?? (await settings).useTestData;
          await settingsDb.update('useTestData', willUseTestData);
          await settingsDb.update('isVerbose', true);
        } catch (error) {
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        process.exit(0);
      })
      .helpOption(false)
      .addHelpOption(false)
      .helpCommand(false);

    program.command('set-verbosity')
      .description("Sets the verbosity level for the application. [Default: false]")
      .argument('<use-test-data>', 'use test data flag')
      .action(async (isVerbose, options) => {
        if (!isValidJSON(isVerbose)) {
          const error = new InvalidArgumentError('Invalid or missing argument: <use-test-data>');
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        try {
          const willUseTestData = JSON.parse(isVerbose) ?? (await settings).isVerbose;
          await settingsDb.update('isVerbose', willUseTestData);
        } catch (error) {
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        process.exit(0);
      })
      .helpOption(false)
      .addHelpOption(false)
      .helpCommand(false);

    const prohibitedArgs = [undefined, null, 'undefined', 'null'];
    program.command('set-username')
      .description('Set the Azure DevOps username.')
      .argument('<username>', 'Azure DevOps username')
      .action(async (azureDevOpsUsername, options) => {
        if (prohibitedArgs.includes(azureDevOpsUsername) || typeof azureDevOpsUsername !== 'string') {
          const error = new InvalidArgumentError('Invalid or missing argument: <username>');
          devOpsService.errorHandler(error);
          process.exit(1);
        }

        try {
          const username = azureDevOpsUsername ?? (await settings).azureDevOpsUsername;
          await settingsDb.update('azureDevOpsUsername', username);
        } catch (error) {
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        process.exit(0);
      })
      .helpOption(false)
      .addHelpOption(false)
      .helpCommand(false);

    program.command('set-pat')
      .description('Set the Azure DevOps personal access token.')
      .argument('<pat>', 'Azure DevOps personal access token')
      .action(async (azureDevOpsPat, options) => {
        if (prohibitedArgs.includes(azureDevOpsPat) || typeof azureDevOpsPat !== 'string') {
          const error = new InvalidArgumentError('Invalid or missing argument: <pat>');
          devOpsService.errorHandler(error);
          process.exit(1);
        }

        try {
          const pat = azureDevOpsPat ?? (await settings).azureDevOpsPat;
          await settingsDb.update('azureDevOpsPat', pat);
        } catch (error) {
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        process.exit(0);
      })
      .helpOption(false)
      .addHelpOption(false)
      .helpCommand(false);

    program.parse();

    const args = process.argv.slice(2);
    if ( args.length === 0 && (await settings).useTestData === true) {
      console.error(chalk.greenBright.underline.bold('### RUNNING IN DEVELOPMENT MODE ###'))
    };

    if ((await settings).azureDevOpsUsername === undefined || (await settings).azureDevOpsUsername === "" || (await settings).azureDevOpsPat === undefined || (await settings).azureDevOpsPat === "") {
      console.error(chalk.red.bold('\nAzure DevOps username and PAT are required.'));
      process.exit(1);
    }
    
    const issues = await jsonStore.issuesDb.read();
    let queryDate = new Date();
    queryDate.setDate(queryDate.getDate()-(await settings).numberOfDaysToQuery);
    const timeOfDayToQueryFrom = Number((await settings).startTimeOfQuery);
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

    await issuesDb.update('index.startTime', localStartTime);
  
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

      await issuesDb.update('index.endTime', localEndTime);
      const { indexPath } = await generateIndexHtml(issues);

      if (indexPath) {
        const state = await openBrowser(indexPath)
        if (state) {
          await sleep(3000).then(() => {
            telemetryClient.flushClient();
            resolve();
            process.exit(0);
          })
        }
      }
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