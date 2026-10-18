import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft } from 'lucide-react';
import MessageBubble from '@/components/valor/MessageBubble';

export default function ConversationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const conv = await base44.entities.Conversation.get(id);
        setConversation(conv);
        const { items } = await base44.entities.Message.filter(
          { conversation_id: id },
          { sort: 'created_date', limit: 500 }
        );
        setMessages(items);
      } catch (e) {
        setConversation(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 px-4 py-10 text-center">
        <p className="text-sm text-slate-400">Conversation not found.</p>
        <Link to="/history" className="mt-3 inline-block text-sm text-cyan-300">
          Back to history
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="mb-4 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft size={16} /> History
        </button>
        <h1 className="mb-6 text-2xl font-semibold text-slate-100">
          {conversation.title || 'Untitled conversation'}
        </h1>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-400">No messages in this conversation.</p>
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}