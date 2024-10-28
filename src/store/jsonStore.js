import { Low } from 'lowdb';
import { JSONFile, JSONFilePreset } from 'lowdb/node';
import { issuesModel, loggingModel, settingsModel } from './models/models.js';

class JsonStore {
  constructor() {
    this.issuesDb = new Low(new JSONFile('./src/store/db/issues.json'), null);
    this.loggingDb = new Low(new JSONFile('./src/store/db/logging.json'), null);
    this.settingsDb = new Low(new JSONFile('./src/store/db/settings.json'), settingsModel);
  }

  async initializeDbs() {
    await this.issuesDb.read();
    this.issuesDb.data = issuesModel;
    await this.issuesDb.write();
    console.log('Issues store initialized');

    await this.loggingDb.read();
    this.loggingDb.data = loggingModel;
    await this.loggingDb.write();
    console.log('Logging store initialized');
    
    await this.settingsDb.read();
    // this.settingsDb.data = settingsModel;
    await this.settingsDb.write();
    console.log('Settings store initialized');
  }
};

const jsonStore = new JsonStore();
await jsonStore.initializeDbs();

export { jsonStore };