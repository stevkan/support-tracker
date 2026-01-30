import { jsonStore } from '../../../store/jsonStore.js';

export async function settingsRoutes(fastify, options) {
  fastify.get('/', async (request, reply) => {
    const settings = await jsonStore.settingsDb.read();
    return settings;
  });

  fastify.patch('/', async (request, reply) => {
    const updates = request.body;
    const currentSettings = await jsonStore.settingsDb.read();
    
    for (const [key, value] of Object.entries(updates)) {
      await jsonStore.settingsDb.update(key, value);
    }
    
    const updatedSettings = await jsonStore.settingsDb.read();
    return updatedSettings;
  });
}
