import keytar from 'keytar';

const SERVICE_NAME = 'support-tracker';

const SecretKeys = {
  GITHUB_TOKEN: 'github-token',
  STACK_OVERFLOW_ENTERPRISE_KEY: 'stack-overflow-key',
  APPINSIGHTS_CONNECTION_STRING: 'appinsights-key',
};

class SecretsStore {
  async getSecret(key) {
    return await keytar.getPassword(SERVICE_NAME, key);
  }

  async setSecret(key, value) {
    await keytar.setPassword(SERVICE_NAME, key, value);
  }

  async deleteSecret(key) {
    return await keytar.deletePassword(SERVICE_NAME, key);
  }

  async getGitHubToken() {
    return await this.getSecret(SecretKeys.GITHUB_TOKEN);
  }

  async setGitHubToken(token) {
    await this.setSecret(SecretKeys.GITHUB_TOKEN, token);
  }

  async getStackOverflowKey() {
    return await this.getSecret(SecretKeys.STACK_OVERFLOW_ENTERPRISE_KEY);
  }

  async setStackOverflowKey(key) {
    await this.setSecret(SecretKeys.STACK_OVERFLOW_ENTERPRISE_KEY, key);
  }

  async getAppInsightsConnectionString() {
    return await this.getSecret(SecretKeys.APPINSIGHTS_CONNECTION_STRING);
  }

  async setAppInsightsConnectionString(value) {
    await this.setSecret(SecretKeys.APPINSIGHTS_CONNECTION_STRING, value);
  }

  async migrateFromEnv() {
    if (process.env.GITHUB_TOKEN) {
      await this.setGitHubToken(process.env.GITHUB_TOKEN);
    }
    if (process.env.STACK_OVERFLOW_ENTERPRISE_KEY) {
      await this.setStackOverflowKey(process.env.STACK_OVERFLOW_ENTERPRISE_KEY);
    }
    if (process.env.APPINSIGHTS_CONNECTION_STRING) {
      await this.setAppInsightsConnectionString(process.env.APPINSIGHTS_CONNECTION_STRING);
    }
  }
}

export const secretsStore = new SecretsStore();
export { SecretKeys };
