import keytar from 'keytar';

const SERVICE_NAME = 'support-tracker';

class CredentialService {
  async setCredential(account, password) {
    await keytar.setPassword(SERVICE_NAME, account, password);
  }

  async getCredential(account) {
    return await keytar.getPassword(SERVICE_NAME, account);
  }

  async deleteCredential(account) {
    return await keytar.deletePassword(SERVICE_NAME, account);
  }

  async getAzureDevOpsPat() {
    return await this.getCredential('azure-devops-pat');
  }

  async setAzureDevOpsPat(pat) {
    await this.setCredential('azure-devops-pat', pat);
  }

  async getAzureDevOpsUsername() {
    return await this.getCredential('azure-devops-username');
  }

  async setAzureDevOpsUsername(username) {
    await this.setCredential('azure-devops-username', username);
  }
}

const credentialService = new CredentialService();

export { credentialService };
