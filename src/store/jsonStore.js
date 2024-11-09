import { Low } from 'lowdb';
import { JSONFile, JSONFilePreset } from 'lowdb/node';
import { Store } from 'storaje-db';
import { issuesModel, loggingModel, settingsModel } from './models/models.js';

class JsonStore {
  constructor() {
    this.issuesDb = new Store('./src/store/db/', 'issues.json', issuesModel);
    this.loggingDb = new Store('./src/store/db/', 'logging.json', loggingModel);
    this.settingsDb = new Store('./src/store/db/', 'settings.json', settingsModel);
  }

  async initializeDbs() {
    const settings = await this.settingsDb.read();
    await this.issuesDb.read();
    await this.loggingDb.read();

    if (settings.isVerbose) {
      console.log('Settings store initialized');
      console.log('Issues store initialized');
      console.log('Logging store initialized');
    }
  }
};

const jsonStore = new JsonStore();
await jsonStore.initializeDbs();

export { jsonStore };