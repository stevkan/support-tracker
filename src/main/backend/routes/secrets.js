import { secretsStore } from '../../../store/secretsStore.js';
import { credentialService } from '../../../store/credentialService.js';

const SUPPORTED_KEYS = [
  'github-token',
  'azure-devops-username',
  'azure-devops-pat',
  'stack-overflow-key',
  'appinsights-key'
];

async function getSecret(key) {
  switch (key) {
    case 'github-token':
      return await secretsStore.getGitHubToken();
    case 'azure-devops-username':
      return await credentialService.getAzureDevOpsUsername();
    case 'azure-devops-pat':
      return await credentialService.getAzureDevOpsPat();
    case 'stack-overflow-key':
      return await secretsStore.getStackOverflowKey();
    case 'appinsights-key':
      return await secretsStore.getAppInsightsConnectionString();
    default:
      return null;
  }
}

async function setSecret(key, value) {
  switch (key) {
    case 'github-token':
      await secretsStore.setGitHubToken(value);
      break;
    case 'azure-devops-username':
      await credentialService.setAzureDevOpsUsername(value);
      break;
    case 'azure-devops-pat':
      await credentialService.setAzureDevOpsPat(value);
      break;
    case 'stack-overflow-key':
      await secretsStore.setStackOverflowKey(value);
      break;
    case 'appinsights-key':
      await secretsStore.setAppInsightsConnectionString(value);
      break;
  }
}

async function deleteSecret(key) {
  switch (key) {
    case 'github-token':
      return await secretsStore.deleteSecret('github-token');
    case 'azure-devops-username':
      return await credentialService.deleteCredential('azure-devops-username');
    case 'azure-devops-pat':
      return await credentialService.deleteCredential('azure-devops-pat');
    case 'stack-overflow-key':
      return await secretsStore.deleteSecret('stack-overflow-key');
    case 'appinsights-key':
      return await secretsStore.deleteSecret('appinsights-key');
    default:
      return false;
  }
}

export async function secretsRoutes(fastify, options) {
  fastify.post('/check', async (request, reply) => {
    const { keys } = request.body;
    
    if (!Array.isArray(keys)) {
      return reply.status(400).send({ error: 'Keys must be an array' });
    }
    
    const results = {};
    for (const key of keys) {
      if (!SUPPORTED_KEYS.includes(key)) {
        results[key] = false;
        continue;
      }
      const value = await getSecret(key);
      results[key] = value != null && value !== '';
    }
    
    return results;
  });

  fastify.get('/:key', async (request, reply) => {
    const { key } = request.params;
    
    if (!SUPPORTED_KEYS.includes(key)) {
      return reply.status(400).send({ error: 'Unsupported secret key' });
    }
    
    const value = await getSecret(key);
    const hasValue = value != null && value !== '';
    
    // If reveal=true query param, return the actual value
    if (request.query.reveal === 'true' && hasValue) {
      return { hasValue, value };
    }
    
    return { hasValue };
  });

  fastify.put('/:key', async (request, reply) => {
    const { key } = request.params;
    const { value } = request.body;
    
    if (!SUPPORTED_KEYS.includes(key)) {
      return reply.status(400).send({ error: 'Unsupported secret key' });
    }
    
    if (typeof value !== 'string') {
      return reply.status(400).send({ error: 'Value must be a string' });
    }
    
    await setSecret(key, value);
    return { success: true };
  });

  fastify.delete('/:key', async (request, reply) => {
    const { key } = request.params;
    
    if (!SUPPORTED_KEYS.includes(key)) {
      return reply.status(400).send({ error: 'Unsupported secret key' });
    }
    
    await deleteSecret(key);
    return { success: true };
  });
}
