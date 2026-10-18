export const SESSION_MS = 180000;
const items = value => Array.isArray(value) ? value : value?.items || [];
const MODELS = ['gpt-realtime-2.1', 'gpt-realtime-2.1-mini'];
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function voiceConfig(secret) {
  const model = secret('VALOR_VOICE_MODEL') || MODELS[0];
  return {
    enabled: secret('VALOR_VOICE_ENABLED') === 'true',
    allowed: new Set((secret('VALOR_VOICE_ALLOWED_USER_IDS') || '').split(',').map(s => s.trim()).filter(Boolean)),
    model: MODELS.includes(model) ? model : MODELS[0],
    daily: Math.min(20, Math.max(1, Math.floor(Number(secret('VALOR_VOICE_DAILY_SESSIONS')) || 5)))
  };
}

export function createVoiceHandler({ clientFromRequest, secret, waitUntil, fetcher = fetch, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  async function hangup(store, row, key) {
    if (row.call_id) {
      const r = await fetcher(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(row.call_id)}/hangup`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000)
      });
      if (!r.ok && r.status !== 404) throw new Error('Hangup not confirmed');
    }
    await store.update(row.id, { state: 'stopped' });
  }
  return async req => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const client = clientFromRequest(req);
      let user;
      try { user = await client.auth.me(); } catch { return json({ error: 'Sign in to use AI voice.' }, 401); }
      if (!user?.id) return json({ error: 'Sign in to use AI voice.' }, 401);
      const config = voiceConfig(secret);
      const bodyText = await req.text();
      if (bodyText.length > 100000) return json({ error: 'Voice connection request is too large.' }, 413);
      let body;
      try { body = JSON.parse(bodyText); } catch { return json({ error: 'Invalid request.' }, 400); }
      const key = secret('OPENAI_API_KEY');
      const store = client.asServiceRole.entities.VoiceSession;
      // Existing calls may always be stopped by their owner, even if disabled.
      if (body.action === 'stop') {
        if (typeof body.sessionId !== 'string' || body.sessionId.length > 128) return json({ error: 'Invalid session.' }, 400);
        const row = await store.get(body.sessionId).catch(() => null);
        if (!row || row.user_id !== user.id) return json({ error: 'Voice session not found.' }, 404);
        if (['active', 'starting'].includes(row.state)) await hangup(store, row, key);
        return json({ stopped: true });
      }
      const allowed = config.enabled && config.allowed.has(user.id) && !!key;
      if (body.action === 'status') return json({ available: allowed, voice: 'marin', model: config.model, maxMs: SESSION_MS, dailySessions: config.daily });
      if (!allowed) return json({ error: 'AI voice is not enabled for this account yet. Text and browser voice remain available.' }, 403);
      if (body.action !== 'start') return json({ error: 'Unknown voice action.' }, 400);
      if (typeof body.sdp !== 'string' || !body.sdp.startsWith('v=0') || body.consent !== true) return json({ error: 'Confirm paid voice use and microphone access before connecting.' }, 400);
      const day = new Date(now()).toISOString().slice(0, 10);
      const sessions = items(await store.filter({ user_id: user.id }, '-created_date', 100));
      for (const row of sessions.filter(s => ['starting', 'active'].includes(s.state) && Date.parse(s.expires_at) <= now())) await hangup(store, row, key);
      if (sessions.some(s => ['active', 'starting'].includes(s.state) && Date.parse(s.expires_at) > now())) return json({ error: 'End your existing AI voice session before starting another.' }, 409);
      if (sessions.filter(s => s.day === day && s.state !== 'failed').length >= config.daily) return json({ error: 'Your daily AI voice session allowance is used. Text chat is still available.' }, 429);
      const reservation = await store.create({ user_id: user.id, day, state: 'starting', expires_at: new Date(now() + SESSION_MS + 30000).toISOString() });
      let remoteId;
      try {
        const preferences = items(await client.entities.UserPreference.filter({}, '-created_date', 1))[0] || {};
        const name = String(preferences.assistant_name || 'Valor').slice(0, 40);
        const personal = String(preferences.preferred_name || '').slice(0, 40);
        const style = ['professional', 'friendly', 'calm', 'witty', 'technical'].includes(preferences.personality) ? preferences.personality : 'friendly';
        const form = new FormData(); form.set('sdp', body.sdp);
        form.set('session', JSON.stringify({
          type: 'realtime', model: config.model, max_output_tokens: 400,
          instructions: `You are an AI personal assistant in the Valor app. The user's saved assistant name is ${JSON.stringify(name)} and preferred name is ${JSON.stringify(personal)}. Use a ${style} conversational style. Speak naturally and concisely. Ask follow-up questions only when useful. Be candid about uncertainty. This is a fresh voice session with no prior conversation context. No action tools or connected services are available. Never claim to access the computer, send messages, publish changes or perform any action. Discuss proposals and explain that consequential actions need the user's review and approval. Do not claim to be human or conscious. Do not repeat an introductory greeting on each answer.`,
          audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } }, output: { voice: 'marin' } }
        }));
        const upstream = await fetcher('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(25000) });
        if (!upstream.ok) {
          const code = (await upstream.json().catch(() => ({}))).error?.code;
          await store.update(reservation.id, { state: 'failed' });
          return json({ error: ['insufficient_quota', 'credit_balance_exhausted'].includes(code) ? 'OpenAI API credits are unavailable. Ask the app owner to check billing.' : 'The AI voice service could not connect. Text chat is still available.' }, 502);
        }
        const sdp = await upstream.text();
        remoteId = upstream.headers.get('location')?.split('/').pop();
        if (!remoteId || !/^[A-Za-z0-9_-]+$/.test(remoteId)) throw new Error('Missing call identifier');
        const current = await store.get(reservation.id);
        if (!current || current.state !== 'starting') {
          await hangup(store, { ...reservation, call_id: remoteId }, key);
          return json({ error: 'Voice connection was cancelled. Start again when ready.' }, 409);
        }
        const expiresAt = now() + SESSION_MS;
        const active = { ...reservation, call_id: remoteId, expires_at: new Date(expiresAt).toISOString(), state: 'active' };
        await store.update(reservation.id, active);
        // Best-effort safeguard, not a guaranteed monetary cap. Deployment also
        // needs the documented scheduled expired-call cleanup.
        waitUntil((async () => { await sleep(SESSION_MS); await hangup(store, active, key); })().catch(() => console.warn('AI voice deadline cleanup needs retry.')));
        return json({ sdp, sessionId: reservation.id, expiresAt, maxMs: SESSION_MS });
      } catch {
        if (remoteId) await hangup(store, { ...reservation, call_id: remoteId }, key).catch(() => {});
        else await store.update(reservation.id, { state: 'failed' }).catch(() => {});
        return json({ error: 'The AI voice connection failed. No automatic retry was made.' }, 502);
      }
    } catch { return json({ error: 'AI voice is temporarily unavailable. Text chat is still available.' }, 503); }
  };
}
