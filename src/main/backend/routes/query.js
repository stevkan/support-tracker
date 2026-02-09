import { randomUUID } from 'crypto';
import { jsonStore } from '../../../store/jsonStore.js';
import { secretsStore } from '../../../store/secretsStore.js';
import { credentialService } from '../../../store/credentialService.js';
import { issuesModel } from '../../../store/models/issuesModel.js';
import {
  GitHubService,
  StackOverflowService,
  InternalStackOverflowService,
  DevOpsService,
} from '../../../../shared/domain/services/index.js';

/**
 * Build service configurations from stored settings.
 * Falls back to default model if settings.repositories is not present.
 */
function buildServiceConfigs(settings) {
  const repos = settings.repositories || {};
  
  const GitHub = {
    repositories: (repos.github || [])
      .filter(r => r.enabled)
      .map(r => {
        const item = { org: r.org, repo: r.repo };
        if (r.labels) item.labels = r.labels;
        if (r.ignoreLabels) item.ignoreLabels = r.ignoreLabels;
        return item;
      }),
    source: 'GitHub',
  };

  const StackOverflow = {
    tags: (repos.stackOverflow || [])
      .filter(t => t.enabled)
      .map(t => t.tag),
    source: 'Stack Overflow',
  };

  const InternalStackOverflow = {
    tags: (repos.internalStackOverflow || [])
      .filter(t => t.enabled)
      .map(t => t.tag),
    source: 'Stack Overflow Internal',
  };

  return { GitHub, StackOverflow, InternalStackOverflow };
}

const jobs = new Map();

function createJob(id, abortController) {
  jobs.set(id, {
    id,
    abortController,
    status: 'running',
    result: null,
    error: null,
    startTime: Date.now(),
    progress: { current: 0, total: 0, currentService: '' },
  });
}

function getJob(id) {
  return jobs.get(id);
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates);
  }
}

function cancelJob(id) {
  const job = jobs.get(id);
  if (job && job.status === 'running') {
    job.abortController.abort();
    job.status = 'cancelled';
    return true;
  }
  return false;
}

async function runQueryJob(jobId, enabledServices, queryParams) {
  const job = getJob(jobId);
  if (!job) return;

  const { signal } = job.abortController;
  const deps = { jsonStore, secretsStore, credentialService };

  const telemetryClient = {
    trackEvent: () => {},
    trackException: () => {},
  };

  try {
    let queryDate = new Date();
    const settings = await jsonStore.settingsDb.read();
    const { GitHub, StackOverflow, InternalStackOverflow } = buildServiceConfigs(settings);

    await jsonStore.settingsDb.update('timestamp.previousRun', settings.timestamp?.lastRun);
    await jsonStore.settingsDb.update('timestamp.lastRun', queryDate.toISOString());

    const numberOfDays = queryParams.numberOfDaysToQuery || settings.queryDefaults?.numberOfDaysToQuery || 1;
    const startHour = queryParams.startHour || settings.queryDefaults?.startHour || 10;

    queryDate.setDate(queryDate.getDate() - numberOfDays);
    queryDate.setHours(startHour, 0, 0, 0);
    queryDate = new Date(queryDate.toUTCString());

    const startTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    await jsonStore.issuesDb.write(issuesModel);
    await jsonStore.issuesDb.update('index.startTime', startTime);

    const results = {
      startTime,
      endTime: null,
      services: {},
    };

    const servicesToRun = [];
    if (enabledServices.stackOverflow) servicesToRun.push('stackOverflow');
    if (enabledServices.internalStackOverflow) servicesToRun.push('internalStackOverflow');
    if (enabledServices.github) servicesToRun.push('github');

    updateJob(jobId, { progress: { current: 0, total: servicesToRun.length, currentService: '' } });

    let serviceIndex = 0;

    if (enabledServices.stackOverflow && job.status === 'running') {
      updateJob(jobId, {
        progress: { current: serviceIndex, total: servicesToRun.length, currentService: 'Stack Overflow' },
      });

      const stackOverflowService = new StackOverflowService(StackOverflow, queryDate, telemetryClient, deps);
      const soResult = await stackOverflowService.process({
        signal,
        onProgress: (tag) => {
          updateJob(jobId, {
            progress: { current: serviceIndex, total: servicesToRun.length, currentService: `Stack Overflow/${tag}` },
          });
        },
      });
      if (soResult instanceof Error) {
        console.error('Stack Overflow service error:', soResult.message);
        results.services.stackOverflow = { status: 'error', message: soResult.message };
      } else {
        results.services.stackOverflow = soResult;
      }
      serviceIndex++;
    }

    if (enabledServices.internalStackOverflow && job.status === 'running') {
      updateJob(jobId, {
        progress: { current: serviceIndex, total: servicesToRun.length, currentService: 'Internal Stack Overflow' },
      });

      const internalStackOverflowService = new InternalStackOverflowService(
        InternalStackOverflow,
        queryDate,
        telemetryClient,
        deps
      );
      const isoResult = await internalStackOverflowService.process({
        signal,
        onProgress: (tag) => {
          updateJob(jobId, {
            progress: { current: serviceIndex, total: servicesToRun.length, currentService: `Internal Stack Overflow/${tag}` },
          });
        },
      });
      if (isoResult instanceof Error) {
        console.error('Internal Stack Overflow service error:', isoResult.message);
        results.services.internalStackOverflow = { status: 'error', message: isoResult.message };
      } else {
        results.services.internalStackOverflow = isoResult;
      }
      serviceIndex++;
    }

    if (enabledServices.github && job.status === 'running') {
      updateJob(jobId, {
        progress: { current: serviceIndex, total: servicesToRun.length, currentService: 'GitHub' },
      });

      const gitHubService = new GitHubService(GitHub, queryDate, telemetryClient, deps);
      const ghResult = await gitHubService.process({
        signal,
        onProgress: (repo) => {
          updateJob(jobId, {
            progress: { current: serviceIndex, total: servicesToRun.length, currentService: `GitHub/${repo}` },
          });
        },
      });
      if (ghResult instanceof Error) {
        console.error('GitHub service error:', ghResult.message);
        results.services.github = { status: 'error', message: ghResult.message };
      } else {
        results.services.github = ghResult;
      }
      serviceIndex++;
    }

    const endTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    results.endTime = endTime;
    await jsonStore.issuesDb.update('index.endTime', endTime);

    const issues = await jsonStore.issuesDb.read();
    results.issues = issues;

    updateJob(jobId, {
      status: 'completed',
      result: results,
      progress: { current: servicesToRun.length, total: servicesToRun.length, currentService: 'Done' },
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      updateJob(jobId, { status: 'cancelled', error: 'Query was cancelled' });
    } else {
      updateJob(jobId, { status: 'error', error: error.message || 'Unknown error' });
    }
  }
}

export async function queryRoutes(fastify, options) {
  fastify.post('/', async (request, reply) => {
    const jobId = randomUUID();
    const abortController = new AbortController();
    const { enabledServices = {}, params = {} } = request.body || {};

    const services = {
      github: enabledServices.github !== false,
      stackOverflow: enabledServices.stackOverflow !== false,
      internalStackOverflow: enabledServices.internalStackOverflow === true,
    };

    createJob(jobId, abortController);

    runQueryJob(jobId, services, params);

    return { jobId };
  });

  fastify.get('/:jobId', async (request, reply) => {
    const { jobId } = request.params;
    const job = getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const safeResult = job.result ? JSON.parse(JSON.stringify(job.result, (key, value) => {
      if (key === 'req' || key === 'res' || key === 'request' || key === 'response' || key === 'socket' || key === 'agent') {
        return undefined;
      }
      return value;
    })) : null;

    return {
      status: job.status,
      result: safeResult,
      error: job.error,
      progress: job.progress,
      elapsedTime: Date.now() - job.startTime,
    };
  });

  fastify.post('/:jobId/cancel', async (request, reply) => {
    const { jobId } = request.params;
    const job = getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    if (job.status !== 'running') {
      return reply.status(400).send({ error: 'Job is not running' });
    }

    cancelJob(jobId);
    return { success: true };
  });

  fastify.get('/', async (request, reply) => {
    const allJobs = Array.from(jobs.values()).map((job) => ({
      id: job.id,
      status: job.status,
      startTime: job.startTime,
      progress: job.progress,
    }));
    return allJobs;
  });
}

export { jobs, createJob, getJob, updateJob, cancelJob };
