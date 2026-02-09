import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Low } from 'lowdb';
import { JSONFile, JSONFilePreset } from 'lowdb/node';
import { Store } from 'storaje-db';
import { issuesModel, loggingModel, settingsModel, testDataModel } from './models/models.js';

const isPackaged = app.isPackaged;
const dataDir = isPackaged
  ? path.join(app.getPath('userData'), 'db')
  : path.join(process.cwd(), 'src', 'store', 'db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class JsonStore {
  constructor() {
    const dbPath = dataDir + path.sep;
    this.issuesDb = new Store(dbPath, 'issues.json', issuesModel);
    this.loggingDb = new Store(dbPath, 'logging.json', loggingModel);
    this.settingsDb = new Store(dbPath, 'settings.json', settingsModel);
    this.testDataDb = new Store(dbPath, 'testData.json', testDataModel);
  }

  reloadTestData() {
    const dbPath = dataDir + path.sep;
    this.testDataDb = new Store(dbPath, 'testData.json', testDataModel);
  }

  async initializeDbs() {
    const settings = await this.settingsDb.read();
    await this.issuesDb.read();
    await this.loggingDb.read();
    await this.testDataDb.read();

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