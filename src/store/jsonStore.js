import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile, JSONFilePreset } from 'lowdb/node';
import { Store } from 'storaje-db';
import { issuesModel, loggingModel, settingsModel } from './models/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class JsonStore {
  constructor() {
    const dbPath = path.relative(process.cwd(), dataDir) + path.sep;
    this.issuesDb = new Store(dbPath, 'issues.json', issuesModel);
    this.loggingDb = new Store(dbPath, 'logging.json', loggingModel);
    this.settingsDb = new Store(dbPath, 'settings.json', settingsModel);
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