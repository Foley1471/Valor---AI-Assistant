const items = value => Array.isArray(value) ? value : value?.items || [];

export function createCleanupHandler({ clientFromRequest, secret, fetcher = fetch, now = Date.now }) {
  return async req => {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    try {
      const client = clientFromRequest(req);
      let user;
      try { user = await client.auth.me(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
      if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const key = secret('OPENAI_API_KEY');
      const store = client.asServiceRole.entities.VoiceSession;
      const rows = [];
      for (const state of ['active', 'starting']) {
        rows.push(...items(await store.filter({ state }, 'expires_at', 500)));
      }
      let stopped = 0, failed = 0;
      for (const row of rows) {
        if (!Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) > now()) continue;
        try {
          if (row.call_id) {
            if (!key) { failed++; continue; }
            const r = await fetcher(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(row.call_id)}/hangup`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
            if (!r.ok && r.status !== 404) { failed++; continue; }
          }
          await store.update(row.id, { state: 'stopped' }); stopped++;
        } catch { failed++; }
      }
      return Response.json({ stopped, failed });
    } catch { return Response.json({ stopped: 0, failed: 1, error: 'Voice cleanup failed; retry required.' }); }
  };
}
