import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { History as HistoryIcon, ChevronRight, Trash2 } from 'lucide-react';

export default function History() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await base44.entities.Conversation.filter(
        {},
        { sort: '-last_active', limit: 100 }
      );
      setConversations(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this conversation and its messages?')) return;
    await base44.entities.Message.deleteMany({ conversation_id: id });
    await base44.entities.Conversation.delete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const fmt = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-slate-100">Conversation History</h1>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <HistoryIcon size={28} className="mx-auto mb-2 text-slate-500" />
            <p className="text-sm text-slate-400">
              No conversations yet. Start talking with your assistant to build your history.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-white/20"
              >
                <Link to={`/conversation/${c.id}`} className="flex-1">
                  <div className="text-sm font-medium text-slate-100">
                    {c.title || 'Untitled conversation'}
                  </div>
                  <div className="text-xs text-slate-500">{fmt(c.last_active || c.created_date)}</div>
                </Link>
                <Link
                  to={`/conversation/${c.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
                >
                  <ChevronRight size={18} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}