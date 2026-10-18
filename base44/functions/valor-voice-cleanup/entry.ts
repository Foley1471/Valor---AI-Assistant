import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { createCleanupHandler } from './service.js';

export default async function (req) {
  try {
    // Initialization stays inside the handler: module-scope construction crashes boot
    // (no logs, generic worker exception) instead of returning a response.
    const handler = createCleanupHandler({
      clientFromRequest: createClientFromRequest,
      secret: name => secrets.get(name)
    });
    return await handler(req);
  } catch (error) {
    return Response.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}
