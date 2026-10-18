import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ConversationView({ messages, interimTranscript }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && !interimTranscript && (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-slate-500 text-center max-w-xs">
            Tap the microphone or type a message to begin your conversation.
          </p>
        </div>
      )}
      {messages.map((m, i) => (
        <MessageBubble key={i} role={m.role} content={m.content} />
      ))}
      {interimTranscript && (
        <MessageBubble role="user" content={interimTranscript} />
      )}
      <div ref={endRef} />
    </div>
  );
}