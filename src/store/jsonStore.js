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
    await this.issuesDb.read();
    // this.issuesDb.db = issuesModel;
    // await this.issuesDb.write();
    console.log('Issues store initialized');

    await this.loggingDb.read();
    // this.loggingDb.db = loggingModel;
    // await this.loggingDb.write();
    console.log('Logging store initialized');
    
    await this.settingsDb.read();
    // this.settingsDb.db = settingsModel;
    // await this.settingsDb.write();
    console.log('Settings store initialized');
  }
};

const jsonStore = new JsonStore();
await jsonStore.initializeDbs();

export { jsonStore };