import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePreference } from '@/hooks/usePreference';
import { PERSONALITY_LABEL } from '@/lib/valorConfig';
import {
  Sparkles,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Sunrise,
  Calendar,
  Bell,
  Cpu,
  ChevronRight,
  Clock
} from 'lucide-react';

export default function Dashboard() {
  const { pref } = usePreference();
  const [convCount, setConvCount] = useState(0);

  useEffect(() => {
    base44.entities.Conversation.count({})
      .then((c) => setConvCount(typeof c === 'number' ? c : 0))
      .catch(() => setConvCount(0));
  }, []);

  const cards = [
    {
      to: '/',
      title: 'AI Conversations',
      desc: 'Talk with your assistant',
      icon: Sparkles,
      soon: false
    },
    {
      to: '/settings',
      title: 'Assistant Settings',
      desc: 'Name, personality, voice & memory',
      icon: SettingsIcon,
      soon: false
    },
    {
      to: '/history',
      title: 'Conversation History',
      desc: `${convCount} saved conversation${convCount === 1 ? '' : 's'}`,
      icon: HistoryIcon,
      soon: false
    },
    {
      to: null,
      title: 'Daily Briefings',
      desc: 'A personalized morning summary',
      icon: Sunrise,
      soon: true
    },
    {
      to: null,
      title: 'Calendar',
      desc: 'View and manage your schedule',
      icon: Calendar,
      soon: true
    },
    {
      to: null,
      title: 'Reminders',
      desc: 'Never forget what matters',
      icon: Bell,
      soon: true
    },
    {
      to: null,
      title: 'Smart-Home Integrations',
      desc: 'Google Home, Pixel Tablet & more',
      icon: Cpu,
      soon: true
    }
  ];

  return (
    <div className="flex-1 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-100">
            Welcome back{pref?.preferred_name ? `, ${pref.preferred_name}` : ''}
          </h1>
          <p className="text-sm text-slate-400">
            {pref?.assistant_name ? `${pref.assistant_name} is ready to help.` : 'Your assistant is ready.'}
          </p>
        </div>

        {pref && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="text-slate-400">Current assistant:</span>
            <span className="font-medium text-cyan-300">{pref.assistant_name}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">{PERSONALITY_LABEL(pref.personality)}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            const inner = (
              <div
                className={`group h-full rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 ${
                  c.soon ? 'opacity-70' : 'hover:bg-white/10'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-300">
                    <Icon size={20} />
                  </div>
                  {c.soon && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      Coming Soon
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-slate-100">{c.title}</div>
                <div className="mt-0.5 text-xs text-slate-400">{c.desc}</div>
                {!c.soon && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-cyan-300">
                    Open <ChevronRight size={14} />
                  </div>
                )}
              </div>
            );
            return c.to ? (
              <Link key={c.title} to={c.to} className="block h-full">
                {inner}
              </Link>
            ) : (
              <div key={c.title} className="h-full">
                {inner}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Clock size={16} className="text-cyan-300" /> Future voice routines
          </div>
          <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-3">
            <div>
              <div className="text-slate-200">Good Morning</div>
              A personalized daily briefing.
            </div>
            <div>
              <div className="text-slate-200">I'm Home</div>
              Activate authorized smart-home routines.
            </div>
            <div>
              <div className="text-slate-200">Good Night</div>
              Trigger supported evening automations.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}