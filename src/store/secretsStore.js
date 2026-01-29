import keytar from 'keytar';

const SERVICE_NAME = 'support-tracker';

const SecretKeys = {
  GITHUB_TOKEN: 'github-token',
  STACK_OVERFLOW_ENTERPRISE_KEY: 'stack-overflow-key',
  APPINSIGHTS_INSTRUMENTATION_KEY: 'appinsights-key',
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

  async getAppInsightsKey() {
    return await this.getSecret(SecretKeys.APPINSIGHTS_INSTRUMENTATION_KEY);
  }

  async setAppInsightsKey(key) {
    await this.setSecret(SecretKeys.APPINSIGHTS_INSTRUMENTATION_KEY, key);
  }

  async migrateFromEnv() {
    if (process.env.GITHUB_TOKEN) {
      await this.setGitHubToken(process.env.GITHUB_TOKEN);
    }
    if (process.env.STACK_OVERFLOW_ENTERPRISE_KEY) {
      await this.setStackOverflowKey(process.env.STACK_OVERFLOW_ENTERPRISE_KEY);
    }
    if (process.env.APPINSIGHTS_INSTRUMENTATION_KEY) {
      await this.setAppInsightsKey(process.env.APPINSIGHTS_INSTRUMENTATION_KEY);
    }
  }
}

export const secretsStore = new SecretsStore();
export { SecretKeys };
