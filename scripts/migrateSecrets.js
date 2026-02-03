import { secretsStore } from '../src/store/secretsStore.js';
import { jsonStore } from '../src/store/jsonStore.js';

console.log('Migrating secrets from .env to OS keychain...');
await secretsStore.migrateFromEnv();
console.log('Secrets migrated to OS keychain.');

console.log('Migrating settings from .env to settings store...');
const settingsDb = jsonStore.settingsDb;

const azureDevOps = {
  org: process.env.AZURE_DEVOPS_ORG || '',
  project: process.env.AZURE_DEVOPS_PROJECT || '',
  apiVersion: process.env.AZURE_DEVOPS_API_VERSION || '6.1',
};
await settingsDb.update('azureDevOps', azureDevOps);

const github = {
  apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com/graphql',
};
await settingsDb.update('github', github);

console.log('Migration complete. You can now remove the .env file or keep it as backup.');
