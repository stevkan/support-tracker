import dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';
import { Command, InvalidArgumentError } from 'commander';
import openBrowser from 'open-web-browser';

import { sleep } from './utils.js';
import { jsonStore } from './store/jsonStore.js';
import { credentialService } from './store/credentialService.js';
import { TelemetryClient } from './telemetryClient.js';
import { DevOpsService, GitHubService, InternalStackOverflowService, StackOverflowService } from '../shared/domain/services/index.js';
import { generateIndexHtml } from './createIndex.js'
import { issuesModel } from './store/models/issuesModel.js';

/**
 * Build service configurations from stored settings.
 */
function buildServiceConfigs(settings) {
  const repos = settings.repositories || {};
  
  const GitHub = {
    repositories: (repos.github || [])
      .filter(r => r.enabled)
      .map(r => {
        const item = { org: r.org, repo: r.repo };
        if (r.labels) item.labels = r.labels;
        if (r.ignoreLabels) item.ignoreLabels = r.ignoreLabels;
        return item;
      }),
    source: 'GitHub',
  };

  const StackOverflow = {
    tags: (repos.stackOverflow || [])
      .filter(t => t.enabled)
      .map(t => t.tag),
    source: 'Stack Overflow',
  };

  const InternalStackOverflow = {
    tags: (repos.internalStackOverflow || [])
      .filter(t => t.enabled)
      .map(t => t.tag),
    source: 'Stack Overflow Internal',
  };

  return { GitHub, StackOverflow, InternalStackOverflow };
}

dotenv.config(process.env);

const issuesDb = jsonStore.issuesDb;
const settingsDb = jsonStore.settingsDb;
const settings = settingsDb.read();
const program = new Command();

try {
  (async () => {
    // Initialize the telemetry client.
    const telemetryClient = await TelemetryClient.create();

    // Initialize dependencies for shared services.
    const deps = { jsonStore, credentialService };

    // Initialize the DevOps service.
    const devOpsService = new DevOpsService(telemetryClient, deps);

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
            case 'set-services':
              program.command('help')
                .usage('set-services')
                .addHelpOption(false)
                .addHelpText('after', chalk.green(`\nExample: npm start set-services --github --no-stackOverflow --no-internalStackOverflow`))
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

    function isValidJSON(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    }

    program.command('set-services')
      .description('Enable or disable query services. Use --service to enable, --no-service to disable.')
      .option('--github', 'Enable GitHub service')
      .option('--no-github', 'Disable GitHub service')
      .option('--stackOverflow', 'Enable Stack Overflow service')
      .option('--no-stackOverflow', 'Disable Stack Overflow service')
      .option('--internalStackOverflow', 'Enable Internal Stack Overflow service')
      .option('--no-internalStackOverflow', 'Disable Internal Stack Overflow service')
      .action(async (options) => {
        try {
          const currentSettings = await settings;
          const enabledServices = currentSettings.enabledServices || {
            github: true,
            stackOverflow: true,
            internalStackOverflow: false,
          };

          if (options.github !== undefined) enabledServices.github = options.github;
          if (options.stackOverflow !== undefined) enabledServices.stackOverflow = options.stackOverflow;
          if (options.internalStackOverflow !== undefined) enabledServices.internalStackOverflow = options.internalStackOverflow;

          await settingsDb.update('enabledServices', enabledServices);
          console.log(chalk.green('Enabled services updated:'));
          console.log(chalk.white(`  GitHub: ${enabledServices.github}`));
          console.log(chalk.white(`  Stack Overflow: ${enabledServices.stackOverflow}`));
          console.log(chalk.white(`  Internal Stack Overflow: ${enabledServices.internalStackOverflow}`));
        } catch (error) {
          devOpsService.errorHandler(error);
          process.exit(1);
        }
        process.exit(0);
      })
      .helpOption(false)
      .addHelpOption(false)
      .helpCommand(false);

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
          await credentialService.setAzureDevOpsUsername(azureDevOpsUsername);
          console.log(chalk.green('Azure DevOps username stored securely.'));
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
          await credentialService.setAzureDevOpsPat(azureDevOpsPat);
          console.log(chalk.green('Azure DevOps PAT stored securely in OS credential manager.'));
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
    const setupCommands = ['set-pat', 'set-username', 'set-services', 'set-use-test-data', 'set-verbosity', 'help'];
    const isSetupCommand = args.length > 0 && setupCommands.some(cmd => args[0] === cmd || args[0] === 'help');
    
    if (isSetupCommand) {
      return;
    }

    if (args.length === 0 && (await settings).useTestData === true) {
      console.error(chalk.greenBright.underline.bold('### RUNNING IN DEVELOPMENT MODE ###'))
    };

    const storedUsername = await credentialService.getAzureDevOpsUsername();
    const storedPat = await credentialService.getAzureDevOpsPat();
    if (!storedUsername || !storedPat) {
      console.error(chalk.red.bold('\nAzure DevOps username and PAT are required.'));
      console.error(chalk.yellow('Run: npm start set-username <username>'));
      console.error(chalk.yellow('Run: npm start set-pat <pat>'));
      process.exit(1);
    }
    
    let queryDate = new Date();
    await settingsDb.update('timestamp.previousRun', (await settings).timestamp.lastRun);
    await settingsDb.update('timestamp.lastRun', queryDate.toISOString());
    const currentSettings = await settings;
    queryDate.setDate(queryDate.getDate() - (currentSettings.queryDefaults?.numberOfDaysToQuery || 1));
    const startHour = Number(currentSettings.queryDefaults?.startHour ?? 10);
    queryDate.setHours(startHour, 0, 0, 0);
    queryDate = new Date(queryDate.toUTCString());
  
    // Calling sleep is necessary to ensure parameters are set before calling the services.
    await sleep(1000);
  
    const enabledServices = currentSettings.enabledServices || {
      github: true,
      stackOverflow: true,
      internalStackOverflow: false,
    };

    const { GitHub, StackOverflow, InternalStackOverflow } = buildServiceConfigs(currentSettings);
    const stackOverflowService = new StackOverflowService(StackOverflow, queryDate, telemetryClient, deps);
    const internalStackOverflowService = new InternalStackOverflowService(InternalStackOverflow, queryDate, telemetryClient, deps);
    const gitHubService = new GitHubService(GitHub, queryDate, telemetryClient, deps);
  
    const startTime = new Date();
    startTime.setDate(startTime.getDate());
    const localStartTime = startTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    console.info(chalk.green.bold(`Starting Processes: ${ localStartTime }`));
    telemetryClient.trackEvent({ name: "Starting Processes", measurements: { date: startTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) } });
    await issuesDb.write(issuesModel);
    await issuesDb.update('index.startTime', localStartTime);

    if (enabledServices.stackOverflow) {
      console.group(chalk.rgb(244, 128, 36).bold('\nProcessing StackOverflow...'))
      await stackOverflowService.process()
        .then(res => {
          const response = devOpsService.handleServiceResponse(res, 'StackOverflowService');
          console.warn(chalk.green.bold('Process status: ') + chalk.red.bold('Completed'));
        })
        .catch(err => devOpsService.handleServiceResponse(err));
      console.groupEnd();
      console.log(chalk.greenBright.bold('\n----------------------------------------------------------------------------------------------------------'));
    }

    if (enabledServices.internalStackOverflow) {
      console.group(chalk.rgb(255, 176, 37).bold('\nProcessing Internal StackOverflow...'))
      await internalStackOverflowService.process()
        .then(res => {
          const { message } = devOpsService.handleServiceResponse(res, 'InternalStackOverflowService');
          console.warn(chalk.green.bold('Process status: ') + chalk.red.bold('Completed'));
        })
        .catch(err => devOpsService.handleServiceResponse(err));
      console.groupEnd();
      console.log(chalk.greenBright.bold('\n----------------------------------------------------------------------------------------------------------'));
    }

    if (enabledServices.github) {
      console.group(chalk.blue.bold('\nProcessing GitHub...'))
      await gitHubService.process()
        .then(res => {
          const { message } = devOpsService.handleServiceResponse(res, 'GitHubService');
          console.warn(chalk.green.bold('Process status: ') + chalk.red.bold('Completed'));
        })
        .catch(err => devOpsService.handleServiceResponse(err));
      console.groupEnd();
    }

    await new Promise(async (resolve) => {
      const endTime = new Date();
      endTime.setDate(endTime.getDate());
      const localEndTime = endTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      console.info(chalk.green.bold(`\nFinished Processes: ${ localEndTime }`));
      telemetryClient.trackEvent({ name: "Finished Processes", measurements: { date: endTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) } });

      await issuesDb.update('index.endTime', localEndTime);
      const issues = await jsonStore.issuesDb.read();
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
        // const state = await openBrowser(indexPath)
        // if (state) {
        //   await sleep(3000).then(() => {
        //     telemetryClient.flushClient();
        //     resolve();
        //     process.exit(0);
        //   })
        // }
      }
    });
  })();
} catch (error) {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
}