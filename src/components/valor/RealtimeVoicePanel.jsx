import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createRealtimeVoice } from '@/lib/realtimeVoice';
import AIOrb from './AIOrb';
import ConversationView from './ConversationView';

export default function RealtimeVoicePanel({ assistantName }) {
  const [availability, setAvailability] = useState(null);
  const [state, setState] = useState({ phase: 'idle', message: 'Start a conversation with Ellie.', remaining: 180 });
  const [messages, setMessages] = useState([]);
  const [consent, setConsent] = useState(false);
  const audio = useRef(null);
  const voice = useRef(null);
  const active = ['connecting', 'listening', 'thinking', 'speaking'].includes(state.phase);

  useEffect(() => {
    let mounted = true;
    const invoke = async data => (await base44.functions.invoke('valor-voice', data)).data;
    if (typeof window.RTCPeerConnection !== 'function' || !navigator.mediaDevices?.getUserMedia) {
      setAvailability({ available: false });
      setState(s => ({ ...s, phase: 'error', message: 'This browser cannot start AI voice. Switch to browser voice or text chat.' }));
      return;
    }
    const connection = createRealtimeVoice({ invoke,
      onState: patch => { if (mounted) setState(s => ({ ...s, ...patch })); },
      onTranscript: message => { if (mounted) setMessages(m => [...m, message]); },
      onAudio: stream => {
        if (!audio.current) return;
        audio.current.srcObject = stream;
        if (stream) audio.current.play().catch(() => { if (mounted) setState(s => ({ ...s, message: 'Press Play on the audio controls to hear Ellie.' })); });
        else audio.current.pause();
      }
    });
    voice.current = connection;
    invoke({ action: 'status' }).then(status => { if (mounted) setAvailability(status); }).catch(() => {
      if (mounted) { setAvailability({ available: false }); setState(s => ({ ...s, message: 'AI voice is not configured yet. Browser voice and text chat remain available.' })); }
    });
    return () => { mounted = false; connection.close(); voice.current = null; };
  }, []);

  useEffect(() => {
    const end = () => voice.current?.close();
    const visibility = () => { if (document.hidden) end(); };
    window.addEventListener('pagehide', end);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', end); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  const start = () => { setMessages([]); voice.current?.start(consent); };
  const orbState = state.phase === 'connecting' ? 'thinking' : state.phase === 'error' ? 'error' : active ? state.phase : 'idle';
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-col items-center px-5 pt-6 text-center">
        <AIOrb state={orbState} level={0} size={240} />
        <h1 className="mt-2 text-lg font-medium text-slate-200">{assistantName || 'Valor'} · Ellie</h1>
        <p role="status" aria-live="polite" className="mt-2 max-w-lg text-sm text-cyan-200">{state.message}</p>
        {active && <p className="mt-2 text-xs tabular-nums text-slate-400">{Math.floor(state.remaining / 60)}:{String(state.remaining % 60).padStart(2, '0')} remaining · {state.phase}</p>}
        {availability && !availability.available && <p className="mt-3 max-w-lg rounded-lg border border-amber-400/30 p-3 text-xs text-amber-200">AI voice is not enabled for this account yet. Choose Browser voice &amp; text above to keep chatting.</p>}
        <audio ref={audio} autoPlay controls aria-label="Ellie audio playback" className="mt-4 h-10 w-full max-w-sm" />
        <label className="mt-4 flex max-w-lg items-start gap-2 text-left text-xs leading-relaxed text-slate-400">
          <input type="checkbox" checked={consent} disabled={active} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-cyan-400" />
          Use paid AI voice. Microphone audio goes to OpenAI. Sessions last up to three minutes in this interface; API costs vary with usage.
        </label>
        <div className="my-4 flex gap-3">
          <button type="button" onClick={start} disabled={active || !consent || !availability?.available} className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 disabled:opacity-40">Talk with Ellie</button>
          <button type="button" onClick={() => voice.current?.close()} disabled={!active} className="rounded-full bg-rose-500/80 px-5 py-3 text-sm text-white disabled:opacity-40">Stop</button>
        </div>
        <p className="mb-3 max-w-lg text-[11px] leading-relaxed text-slate-500">AI-generated voice. Each voice session starts fresh. Transcripts appear here but are not saved to History. No connected action tools are enabled. Switching modes, hiding this page, or pressing Stop releases your microphone.</p>
      </div>
      <ConversationView messages={messages} interimTranscript="" />
    </section>
  );
}
