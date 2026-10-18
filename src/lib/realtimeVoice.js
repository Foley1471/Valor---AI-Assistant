// Connection lifecycle is separate from React so it can be tested without a
// microphone or paid API requests.
export function createRealtimeVoice({ invoke, media = navigator.mediaDevices, Peer = RTCPeerConnection, onState, onAudio, onTranscript, clock = Date.now, timers = globalThis }) {
  let run = 0, peer, stream, channel, sessionId, startup, deadline, ticker;
  const seen = new Set();
  const emit = state => onState(state);
  async function close(message = 'Voice session ended.') {
    const closing = ++run; timers.clearTimeout(startup); timers.clearInterval(ticker); startup = null; ticker = null;
    const id = sessionId; sessionId = null;
    channel?.close(); channel = null; peer?.close(); peer = null;
    stream?.getTracks().forEach(t => t.stop()); stream = null; onAudio(null);
    emit({ phase: 'idle', message, remaining: 0 });
    if (id) {
      try { await invoke({ action: 'stop', sessionId: id }); }
      catch { if (closing === run) emit({ phase: 'error', message: 'Microphone stopped. Server cleanup could not be confirmed; please contact the app owner.', remaining: 0 }); }
    }
  }
  async function start(consent) {
    if (peer || startup || !consent) return;
    const token = ++run; seen.clear();
    emit({ phase: 'connecting', message: 'Connecting Ellie…', remaining: 180 });
    startup = timers.setTimeout(() => { if (token === run) { close('Connection timed out. Try again or switch to browser voice.'); } }, 30000);
    try {
      const mic = await media.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (token !== run) { mic.getTracks().forEach(t => t.stop()); return; }
      stream = mic; peer = new Peer(); const connection = peer;
      mic.getTracks().forEach(t => connection.addTrack(t, mic));
      connection.ontrack = event => { if (token === run) onAudio(event.streams[0]); };
      connection.onconnectionstatechange = () => { if (token === run && ['failed', 'disconnected'].includes(connection.connectionState)) close('Voice connection interrupted. Please start again.'); };
      channel = connection.createDataChannel('oai-events');
      channel.onopen = () => {
        if (token !== run) return;
        timers.clearTimeout(startup); startup = null;
        emit({ phase: 'listening', message: 'Ellie is ready. Go ahead.', remaining: Math.max(0, Math.ceil((deadline - clock()) / 1000)) });
      };
      channel.onclose = () => { if (token === run) close('Voice connection ended. You can start again.'); };
      channel.onmessage = event => {
        if (token !== run) return;
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'error' || data.type === 'conversation.item.input_audio_transcription.failed') { close('The voice service reported a problem. Text chat is still available.'); return; }
        const phases = { 'input_audio_buffer.speech_started': 'listening', 'input_audio_buffer.speech_stopped': 'thinking', 'output_audio_buffer.started': 'speaking', 'output_audio_buffer.stopped': 'listening' };
        if (phases[data.type]) emit({ phase: phases[data.type] });
        if (data.type === 'response.done' && data.response?.status === 'failed') { close('The voice reply failed. Ask the app owner to check API billing and access.'); return; }
        let role, text, id;
        if (data.type === 'conversation.item.input_audio_transcription.completed') { role = 'user'; text = data.transcript; id = `user:${data.item_id}`; }
        if (data.type === 'response.output_audio_transcript.done') { role = 'assistant'; text = data.transcript; id = `assistant:${data.item_id}:${data.content_index}`; }
        if (role && typeof text === 'string' && text.trim() && !seen.has(id)) { seen.add(id); onTranscript({ role, content: text.trim().slice(0, 12000) }); }
      };
      const offer = await connection.createOffer(); await connection.setLocalDescription(offer);
      const result = await invoke({ action: 'start', consent: true, sdp: offer.sdp });
      if (token !== run) { await invoke({ action: 'stop', sessionId: result.sessionId }).catch(() => {}); return; }
      sessionId = result.sessionId; deadline = result.expiresAt;
      await connection.setRemoteDescription({ type: 'answer', sdp: result.sdp });
      if (token !== run) return;
      ticker = timers.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadline - clock()) / 1000));
        if (!remaining) close('Your three-minute voice session is complete.'); else emit({ remaining });
      }, 250);
    } catch (error) {
      if (token !== run) return;
      const message = error?.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it for this site, or use text chat.' : error?.response?.data?.error || 'Ellie could not connect. Text chat and browser voice are still available.';
      await close(message); emit({ phase: 'error', message });
    }
  }
  return { start, close };
}
