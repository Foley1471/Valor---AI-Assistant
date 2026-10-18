import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { createCleanupHandler } from './service.js';

export default createCleanupHandler({ clientFromRequest: createClientFromRequest, secret: name => secrets.get(name) });
