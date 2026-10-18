import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets, waitUntil } from 'base44:runtime';
import { createVoiceHandler } from './service.js';

export default createVoiceHandler({ clientFromRequest: createClientFromRequest, secret: name => secrets.get(name), waitUntil });
