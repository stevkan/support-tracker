export const settingsModel = {
  useTestData: false,
  isVerbose: false,
  timestamp: {
    lastRun: null,
    previousRun: null,
  },
  numberOfDaysToQuery: 1,
  runInDebugMode: false,
  startTimeOfQuery: 11,
  azureDevOps: {
    org: '',
    project: '',
    apiVersion: '6.1',
  },
  github: {
    apiUrl: 'https://api.github.com/graphql',
  },
};