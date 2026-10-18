import { Mic, Square, Send, Waves } from 'lucide-react';

export default function VoiceControls({
  isListening,
  isSpeaking,
  isThinking,
  recognitionSupported,
  voiceMode,
  audioLevel,
  inputText,
  onMic,
  onStop,
  onToggleVoiceMode,
  onTextChange,
  onSend
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const busy = isListening || isSpeaking;

  return (
    <div className="border-t border-white/10 bg-slate-950/60 backdrop-blur px-4 py-3">
      <div className="mx-auto max-w-2xl">
        {isListening && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
              Listening
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-400 transition-[width] duration-100 ease-out"
                style={{ width: `${Math.max(4, Math.round(audioLevel * 100))}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMic}
            disabled={!recognitionSupported || isThinking}
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
              isListening
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-white/10 text-cyan-300 hover:bg-white/20'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            title={recognitionSupported ? 'Talk' : 'Voice input not supported in this browser'}
          >
            {isListening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/50" />
            )}
            <Mic size={20} className="relative" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking}
            placeholder={voiceMode ? 'Listening… or type instead' : 'Type a message…'}
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400/50 disabled:opacity-50"
          />

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/80 text-white hover:bg-rose-500"
              title="Stop"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!inputText.trim() || isThinking}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              title="Send"
            >
              <Send size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleVoiceMode}
            disabled={!recognitionSupported}
            aria-pressed={voiceMode}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
              voiceMode
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
            title={voiceMode ? 'Voice mode on — tap to end' : 'Voice mode: hands-free conversation'}
          >
            <Waves size={20} />
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-slate-500">
          {voiceMode
            ? 'Voice mode is on. Talk naturally, then pause — tap Stop to end.'
            : 'Talk to speak, or type a message.'}
        </p>
      </div>
    </div>
  );
}