import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePreference } from '@/hooks/usePreference';
import { useVoice } from '@/hooks/useVoice';
import { STARTER_NAMES, PERSONALITIES } from '@/lib/valorConfig';
import { Volume2, Trash2, RefreshCw, Save } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { pref, save, reload } = usePreference();
  const { voices, speak, synthesisSupported } = useVoice();

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (pref) {
      setForm({
        preferred_name: pref.preferred_name || '',
        assistant_name: pref.assistant_name || STARTER_NAMES[0],
        personality: pref.personality || 'friendly',
        voice: pref.voice || '',
        speech_rate: pref.speech_rate ?? 1,
        speech_pitch: pref.speech_pitch ?? 1,
        memory_enabled: pref.memory_enabled !== false
      });
    }
  }, [pref]);

  if (!form) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </div>
    );
  }

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const clearAllConversations = async () => {
    if (!confirm('Delete all conversations and messages? This cannot be undone.')) return;
    setClearing(true);
    try {
      const { items: convs } = await base44.entities.Conversation.filter(
        {},
        { limit: 500 }
      );
      for (const c of convs) {
        await base44.entities.Message.deleteMany({ conversation_id: c.id });
      }
      await base44.entities.Conversation.deleteMany({});
      await reload();
    } finally {
      setClearing(false);
    }
  };

  const resetOnboarding = async () => {
    if (!confirm('Reset onboarding? Your assistant will walk you through setup again.')) return;
    await save({ onboarding_complete: false, first_greeting_done: false });
    navigate('/onboarding', { replace: true });
  };

  return (
    <div className="flex-1 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>

        {/* Assistant identity */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-400">
            Assistant
          </h2>

          <label className="text-xs text-slate-400">Assistant name</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {STARTER_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set('assistant_name', n)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  form.assistant_name === n
                    ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={STARTER_NAMES.includes(form.assistant_name) ? '' : form.assistant_name}
            onChange={(e) => set('assistant_name', e.target.value)}
            placeholder="Or type a custom name"
            maxLength={24}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
          />

          <label className="mt-4 block text-xs text-slate-400">Personality</label>
          <select
            value={form.personality}
            onChange={(e) => set('personality', e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
          >
            {PERSONALITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </section>

        {/* Voice */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-400">
            Voice
          </h2>
          {synthesisSupported ? (
            <>
              <label className="text-xs text-slate-400">Voice</label>
              <div className="mt-1 flex gap-2">
                <select
                  value={form.voice}
                  onChange={(e) => set('voice', e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
                >
                  <option value="">System default</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} {v.lang ? `(${v.lang})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    speak(`Hello, I'm ${form.assistant_name}.`, { voiceURI: form.voice, rate: form.speech_rate, pitch: form.speech_pitch })
                  }
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-cyan-300 hover:bg-white/10"
                >
                  <Volume2 size={16} /> Preview
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                These are the voices installed on this device, so only the ones your browser
                supports are listed. Premium AI voices are planned for a later update.
              </p>

              <label className="mt-4 block text-xs text-slate-400">
                Speed: {form.speech_rate.toFixed(1)}×
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={form.speech_rate}
                onChange={(e) => set('speech_rate', parseFloat(e.target.value))}
                className="mt-1 w-full accent-cyan-400"
              />

              <label className="mt-3 block text-xs text-slate-400">
                Pitch: {form.speech_pitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={form.speech_pitch}
                onChange={(e) => set('speech_pitch', parseFloat(e.target.value))}
                className="mt-1 w-full accent-cyan-400"
              />
            </>
          ) : (
            <p className="text-sm text-slate-400">
              Voice output isn't supported in this browser.
            </p>
          )}
        </section>

        {/* Personal */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-400">
            You
          </h2>
          <label className="text-xs text-slate-400">Preferred name</label>
          <input
            type="text"
            value={form.preferred_name}
            onChange={(e) => set('preferred_name', e.target.value)}
            placeholder="What should I call you?"
            maxLength={40}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
          />
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.memory_enabled}
              onChange={(e) => set('memory_enabled', e.target.checked)}
              className="accent-cyan-400"
            />
            Save conversation history to my account
          </label>
        </section>

        {/* Memory & data */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-400">
            Memory & Data
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            Your conversations and preferences are private to your account. You can review,
            edit, or delete them at any time.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={clearAllConversations}
              disabled={clearing}
              className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/20"
            >
              <Trash2 size={16} /> {clearing ? 'Clearing…' : 'Clear all conversations'}
            </button>
            <button
              type="button"
              onClick={resetOnboarding}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              <RefreshCw size={16} /> Reset onboarding
            </button>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-cyan-300">Saved</span>}
        </div>
      </div>
    </div>
  );
}