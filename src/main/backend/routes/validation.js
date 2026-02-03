import { DevOpsService } from '../../../../shared/domain/services/DevOpsService.js';
import { GitHubService } from '../../../../shared/domain/services/GitHubService.js';
import { InternalStackOverflowService } from '../../../../shared/domain/services/InternalStackOverflowService.js';
import { credentialService } from '../../../store/credentialService.js';
import { secretsStore } from '../../../store/secretsStore.js';
import { jsonStore } from '../../../store/jsonStore.js';

export async function validationRoutes(fastify, options) {
  fastify.post('/azure-devops', async (request, reply) => {
    const { org, username, pat, apiVersion } = request.body;

    if (!org) {
      return reply.status(400).send({ error: 'Organization is required' });
    }
    if (!pat) {
      return reply.status(400).send({ error: 'PAT is required' });
    }

    const devOpsService = new DevOpsService(null, { jsonStore, credentialService });
    const result = await devOpsService.validateCredentials({ org, username, pat, apiVersion });

    return result;
  });

  fastify.get('/azure-devops', async (request, reply) => {
    const settings = await jsonStore.settingsDb.read();
    const org = settings?.azureDevOps?.org;
    const apiVersion = settings?.azureDevOps?.apiVersion;

    if (!org) {
      return { valid: false, error: 'Organization not configured' };
    }

    const username = await credentialService.getAzureDevOpsUsername();
    const pat = await credentialService.getAzureDevOpsPat();

    if (!pat) {
      return { valid: false, error: 'PAT not configured' };
    }

    const devOpsService = new DevOpsService(null, { jsonStore, credentialService });
    const result = await devOpsService.validateCredentials({ org, username, pat, apiVersion });

    return result;
  });

  // GitHub Token validation
  fastify.post('/github', async (request, reply) => {
    const { token } = request.body;

    if (!token) {
      return reply.status(400).send({ error: 'GitHub token is required' });
    }

    const result = await GitHubService.validateToken(token);
    return result;
  });

  fastify.get('/github', async (request, reply) => {
    const token = await secretsStore.getGitHubToken();

    if (!token) {
      return { valid: false, error: 'GitHub token not configured' };
    }

    const result = await GitHubService.validateToken(token);
    return result;
  });

  // Stack Overflow Enterprise Key validation
  fastify.post('/stackoverflow', async (request, reply) => {
    const { apiKey } = request.body;

    if (!apiKey) {
      return reply.status(400).send({ error: 'Stack Overflow Enterprise key is required' });
    }

    const result = await InternalStackOverflowService.validateApiKey(apiKey);
    return result;
  });

  fastify.get('/stackoverflow', async (request, reply) => {
    const apiKey = await secretsStore.getStackOverflowKey();

    if (!apiKey) {
      return { valid: false, error: 'Stack Overflow Enterprise key not configured' };
    }

    const result = await InternalStackOverflowService.validateApiKey(apiKey);
    return result;
  });
}
