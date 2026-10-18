import { User, Sparkles } from 'lucide-react';

export default function MessageBubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-cyan-500/20 text-cyan-300'
            : 'bg-violet-500/20 text-violet-300'
        }`}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-cyan-500/10 text-cyan-50 border border-cyan-400/20'
            : 'bg-white/5 text-slate-100 border border-white/10'
        }`}
      >
        {content}
      </div>
    </div>
  );
}