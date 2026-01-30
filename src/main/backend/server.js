import Fastify from 'fastify';
import cors from '@fastify/cors';
import { settingsRoutes } from './routes/settings.js';
import { secretsRoutes } from './routes/secrets.js';
import { queryRoutes } from './routes/query.js';

export async function buildServer() {
  const fastify = Fastify({ logger: true });
  
  await fastify.register(cors, { origin: true });
  
  fastify.register(settingsRoutes, { prefix: '/api/settings' });
  fastify.register(secretsRoutes, { prefix: '/api/secrets' });
  fastify.register(queryRoutes, { prefix: '/api/queries' });
  
  return fastify;
}

export async function startServer(port = 0) {
  const server = await buildServer();
  const address = await server.listen({ port, host: '127.0.0.1' });
  return { server, address, port: server.server.address().port };
}
