import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreference } from '@/hooks/usePreference';
import { useVoice } from '@/hooks/useVoice';
import { STARTER_NAMES, PERSONALITIES } from '@/lib/valorConfig';
import { ArrowRight, Check, Volume2 } from 'lucide-react';

export default function Onboarding() {
  const navigate = useNavigate();
  const { pref, save, loading } = usePreference();
  const { voices, speak, synthesisSupported } = useVoice();

  const [step, setStep] = useState(0);
  const [assistantName, setAssistantName] = useState(
    pref?.assistant_name || STARTER_NAMES[0]
  );
  const [customName, setCustomName] = useState(
    pref?.assistant_name && !STARTER_NAMES.includes(pref.assistant_name)
      ? pref.assistant_name
      : ''
  );
  const [useCustom, setUseCustom] = useState(
    pref?.assistant_name ? !STARTER_NAMES.includes(pref.assistant_name) : false
  );
  const [personality, setPersonality] = useState(pref?.personality || 'friendly');
  const [preferredName, setPreferredName] = useState(pref?.preferred_name || '');
  const [voice, setVoice] = useState(pref?.voice || '');
  const [saving, setSaving] = useState(false);

  const finalName = useCustom ? customName.trim() : assistantName;

  const handleFinish = async () => {
    if (!finalName) return;
    setSaving(true);
    try {
      await save({
        assistant_name: finalName,
        personality,
        preferred_name: preferredName.trim(),
        voice,
        onboarding_complete: true,
        first_greeting_done: false
      });
      navigate('/', { replace: true });
    } catch (e) {
      setSaving(false);
    }
  };

  const previewVoice = () => {
    speak(`Hello, I'm ${finalName || 'your assistant'}.`, { voiceURI: voice });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </div>
    );
  }

  const steps = ['Name', 'Personality', 'You'];

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
        <div className="mb-6 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`h-1.5 flex-1 rounded-full ${
                  i <= step ? 'bg-cyan-400' : 'bg-white/10'
                }`}
              />
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Name your assistant</h2>
              <p className="text-sm text-slate-400">Choose a name, or create your own.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STARTER_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setAssistantName(n);
                    setUseCustom(false);
                  }}
                  className={`rounded-lg border px-3 py-3 text-sm transition ${
                    !useCustom && assistantName === n
                      ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="accent-cyan-400"
                />
                Use a custom name
              </label>
              {useCustom && (
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Nova"
                  maxLength={24}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
                />
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Pick a personality</h2>
              <p className="text-sm text-slate-400">How should {finalName} communicate?</p>
            </div>
            <div className="space-y-2">
              {PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonality(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    personality === p.id
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">{p.label}</div>
                    <div className="text-xs text-slate-400">{p.description}</div>
                  </div>
                  {personality === p.id && <Check size={18} className="text-cyan-300" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">A bit about you</h2>
              <p className="text-sm text-slate-400">Optional, but it makes conversations warmer.</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Your preferred name
              </label>
              <input
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="What should I call you?"
                maxLength={40}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
              />
            </div>
            {synthesisSupported && (
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">
                  Voice
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
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
                    onClick={previewVoice}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-cyan-300 hover:bg-white/10"
                  >
                    <Volume2 size={16} /> Preview
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm text-slate-400 disabled:opacity-30"
          >
            Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !finalName}
              className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving || !finalName}
              className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
            >
              {saving ? 'Setting up…' : 'Begin'} <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}