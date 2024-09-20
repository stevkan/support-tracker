import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const indexModel = {
  index: {
    startTime: '',
    stackOverflow: {
      found: {
        issues: [],
        count: 0
      },
      devOps: [],
      newIssues: {
        issues: [],
        count: 0
      },
    },
    internalStackOverflow: {
      found: {
        issues: [],
        count: 0
      },
      devOps: [],
      newIssues: {
        issues: [],
        count: 0
      },
    },
    github: {
      found: {
        issues: [],
        count: 0
      },
      devOps: [],
      newIssues: {
        issues: [],
        count: 0
      },
    },
    endTime: ''
  }
}

class JsonStore {
  constructor() {
    this.db = new Low(new JSONFile('index.json'), indexModel);
    (async () => {
      await this.db.read();
      this.db.data = indexModel;
      await this.db.write();
    })();
  }
};

const jsonStore = new JsonStore();

export { jsonStore };