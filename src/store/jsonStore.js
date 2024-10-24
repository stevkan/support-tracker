import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { issuesModel, loggingModel } from './models/models.js';

class JsonStore {
  constructor() {
    this.issuesDb = new Low(new JSONFile('issues.json'), null);
    this.loggingDb = new Low(new JSONFile('logging.json'), null);
    this.loggingDb = new Low(new JSONFile('settings.json'), null);
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
  }
};

const jsonStore = new JsonStore();
jsonStore.initializeDbs();

export { jsonStore };