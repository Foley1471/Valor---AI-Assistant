import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePreference } from '@/hooks/usePreference';
import { useVoice } from '@/hooks/useVoice';
import AIOrb from '@/components/valor/AIOrb';
import ConversationView from '@/components/valor/ConversationView';
import VoiceControls from '@/components/valor/VoiceControls';
import RealtimeVoicePanel from '@/components/valor/RealtimeVoicePanel';

export default function Home() {
  const navigate = useNavigate();
  const { pref, loading, save } = usePreference();
  const {
    isListening,
    isSpeaking,
    interimTranscript,
    audioLevel,
    speechLevel,
    micError,
    speechError,
    recognitionSupported,
    synthesisSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    clearErrors
  } = useVoice();

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState(null);
  const [voiceMode, setVoiceMode] = useState(false);

  const [experience, setExperience] = useState('realtime');
  const experienceRef = useRef('realtime');
  const changeExperience = (next) => {
    experienceRef.current = next;
    setVoiceMode(false);
    stopListening();
    cancelSpeech();
    setExperience(next);
  };

  const greetedRef = useRef(false);
  const voiceModeRef = useRef(false);
  const thinkingRef = useRef(false);
  const handleSendRef = useRef(null);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Onboarding first
  useEffect(() => {
    if (loading) return;
    if (!pref || !pref.onboarding_complete) {
      navigate('/onboarding', { replace: true });
    }
  }, [pref, loading, navigate]);

  // The first-time greeting, and only that. Resetting preferences in Settings
  // clears the flag so it can run again.
  useEffect(() => {
    if (experience !== 'browser' || loading || !pref || !pref.onboarding_complete) return;
    if (pref.first_greeting_done || greetedRef.current) return;
    greetedRef.current = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('valorAI', {
          mode: 'greeting',
          isFirstTime: true,
          personality: pref.personality,
          assistantName: pref.assistant_name,
          preferredName: pref.preferred_name
        });
        const reply = res?.data?.reply;
        if (!reply) return;
        setMessages((prev) => [...prev, { role: 'assistant', content: reply, greeting: true }]);
        await save({ first_greeting_done: true });
        if (experienceRef.current === 'browser') speak(reply, {
          voiceURI: pref.voice,
          rate: pref.speech_rate ?? 1,
          pitch: pref.speech_pitch ?? 1
        });
      } catch (e) {
        // A failed greeting must never block the assistant from loading.
      }
    })();
  }, [pref, loading, save, speak, experience]);

  const handleSend = useCallback(
    async (text) => {
      const trimmed = (text ?? '').trim();
      if (!trimmed || thinkingRef.current) return;
      cancelSpeech();
      clearErrors();
      setError(null);

      const userMsg = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      thinkingRef.current = true;
      setIsThinking(true);

      const history = [...messages, userMsg]
        .filter((m) => !m.greeting)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        let convId = conversationId;
        if (!convId) {
          const conv = await base44.entities.Conversation.create({
            title: trimmed.slice(0, 50),
            last_active: new Date().toISOString()
          });
          convId = conv.id;
          setConversationId(convId);
        }
        await base44.entities.Message.create({
          conversation_id: convId,
          role: 'user',
          content: trimmed
        });

        const res = await base44.functions.invoke('valorAI', {
          mode: 'chat',
          messages: history,
          personality: pref?.personality,
          assistantName: pref?.assistant_name,
          preferredName: pref?.preferred_name
        });
        const reply = res?.data?.reply || 'I apologize, I could not generate a response.';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        await base44.entities.Message.create({
          conversation_id: convId,
          role: 'assistant',
          content: reply
        });
        await base44.entities.Conversation.update(convId, {
          last_active: new Date().toISOString()
        });
        if (experienceRef.current === 'browser') speak(reply, {
          voiceURI: pref?.voice,
          rate: pref?.speech_rate ?? 1,
          pitch: pref?.speech_pitch ?? 1
        });
      } catch (e) {
        // Never surface raw server or provider detail to the user.
        console.error('VALOR request failed:', e?.response?.data?.error || e?.message);
        const friendly = 'Sorry, I had trouble reaching my servers. Please try again in a moment.';
        setError(friendly);
        setMessages((prev) => [...prev, { role: 'assistant', content: friendly }]);
      } finally {
        thinkingRef.current = false;
        setIsThinking(false);
      }
    },
    [cancelSpeech, clearErrors, conversationId, messages, pref, speak]
  );

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const listenOnce = useCallback(() => {
    startListening((text) => handleSendRef.current?.(text));
  }, [startListening]);

  // Voice mode: whenever VALOR is idle, listen again. It never listens while
  // speaking, so it cannot hear its own voice.
  useEffect(() => {
    if (!voiceMode || !recognitionSupported) return;
    if (loading || !pref?.onboarding_complete) return;
    if (isListening || isThinking || isSpeaking || micError || speechError) return;
    const timer = setTimeout(() => {
      if (voiceModeRef.current && !thinkingRef.current) listenOnce();
    }, 350);
    return () => clearTimeout(timer);
  }, [
    voiceMode,
    recognitionSupported,
    loading,
    pref,
    isListening,
    isThinking,
    isSpeaking,
    micError,
    speechError,
    listenOnce
  ]);

  // Playback and microphone errors both stop hands-free retries until the
  // user has explicitly recovered. Avoid permission prompts looping forever.
  useEffect(() => {
    if ((micError || speechError) && voiceMode) setVoiceMode(false);
  }, [micError, speechError, voiceMode]);

  const handleMic = () => {
    if (isListening) {
      setVoiceMode(false);
      stopListening();
      return;
    }
    listenOnce();
  };

  const handleStop = () => {
    setVoiceMode(false);
    stopListening();
    cancelSpeech();
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      setVoiceMode(false);
      stopListening();
      cancelSpeech();
      return;
    }
    // Start immediately inside the user's click, rather than waiting for
    // a React effect. Speech recognition can require transient user activation.
    setVoiceMode(true);
    listenOnce();
  };

  // An explicit button press is the most reliable way to unlock speech audio
  // in browsers that block playback after an asynchronous AI request.
  const testVoice = () => {
    stopListening();
    speak("Greetings, my friend. Valor voice is ready.", {
      voiceURI: pref?.voice,
      rate: pref?.speech_rate ?? 1,
      pitch: pref?.speech_pitch ?? 1
    });
  };

  const lastAssistantReply = [...messages].reverse().find((m) => m.role === 'assistant')?.content;

  const replayReply = () => {
    if (!lastAssistantReply) return;
    stopListening();
    speak(lastAssistantReply, {
      voiceURI: pref?.voice,
      rate: pref?.speech_rate ?? 1,
      pitch: pref?.speech_pitch ?? 1
    });
  };

  const orbState = isListening
    ? 'listening'
    : isThinking
    ? 'thinking'
    : isSpeaking
    ? 'speaking'
    : micError || speechError
    ? 'error'
    : 'idle';

  const orbLevel = isListening ? audioLevel : isSpeaking ? speechLevel : 0;
  const voiceIssue = micError || speechError;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-center gap-2 px-4 pt-4" aria-label="Conversation mode">
        <button type="button" aria-pressed={experience === 'realtime'} onClick={() => changeExperience('realtime')} className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200">AI voice · Ellie</button>
        <button type="button" aria-pressed={experience === 'browser'} onClick={() => changeExperience('browser')} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200">Browser voice &amp; text</button>
      </div>
      {experience === 'realtime' ? <RealtimeVoicePanel assistantName={pref?.assistant_name} /> : <>
      <div className="flex flex-col items-center pt-6 pb-2">
        <AIOrb state={orbState} level={orbLevel} size={260} />
        <h1 className="mt-2 text-lg font-medium text-slate-200">
          {pref?.assistant_name || 'Valor'}
        </h1>
      </div>

      {!recognitionSupported && (
        <div className="mx-4 mb-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Voice input isn't supported in this browser. You can still type your messages.
        </div>
      )}
      {!synthesisSupported && (
        <div className="mx-4 mb-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Voice output isn't supported in this browser. Responses will appear as text only. Try Chrome on your Pixel Tablet or Windows device.
        </div>
      )}
      {voiceIssue && (
        <div className="mx-4 mb-1 flex items-start gap-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <span className="flex-1">{voiceIssue}</span>
          <button
            type="button"
            onClick={clearErrors}
            className="shrink-0 text-rose-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mx-4 mb-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <ConversationView messages={messages} interimTranscript={interimTranscript} />

      <VoiceControls
        isListening={isListening}
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        recognitionSupported={recognitionSupported}
        synthesisSupported={synthesisSupported}
        hasReply={!!lastAssistantReply}
        onTestVoice={testVoice}
        onReplayReply={replayReply}
        voiceMode={voiceMode}
        audioLevel={audioLevel}
        inputText={inputText}
        onMic={handleMic}
        onStop={handleStop}
        onToggleVoiceMode={toggleVoiceMode}
        onTextChange={setInputText}
        onSend={() => handleSend(inputText)}
      />
      </>}
    </div>
  );
}
