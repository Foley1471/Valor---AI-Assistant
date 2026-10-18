import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useVoice is the single seam between VALOR's interface and the browser's voice
 * stack (Web Speech API). Everything that listens, transcribes, or speaks goes
 * through this hook, so a real-time speech-to-speech provider can later replace
 * the internals here without any page changing.
 */

const RECOGNITION_ERRORS = {
  'not-allowed':
    'Microphone access is blocked. Allow microphone permission for this site in your browser, then tap the microphone again.',
  'service-not-allowed':
    'Microphone access is blocked by the browser. Check this site’s permissions and try again.',
  'audio-capture': 'No microphone was found on this device. Connect a microphone and try again.',
  network: 'Speech recognition needs an internet connection. Check your connection and try again.',
  'language-not-supported': 'Speech recognition does not support this language on this device.'
};

const LISTEN_WATCHDOG_MS = 25000;
const MIC_LEVEL_GAIN = 3.2;
const LEVEL_UPDATE_MS = 60;

export function useVoice() {
  const [voices, setVoices] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micError, setMicError] = useState(null);
  const [speechError, setSpeechError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [speechLevel, setSpeechLevel] = useState(0);

  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const watchdogRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const levelRafRef = useRef(null);
  const levelStampRef = useRef(0);
  const speakDoneRef = useRef(null);
  const keepAliveRef = useRef(null);
  const speechRafRef = useRef(null);
  const speechStampRef = useRef(0);
  const lastBoundaryRef = useRef(0);
  const speechTokenRef = useRef(0);
  const speechStartTimeoutRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const meterTokenRef = useRef(0);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const recognitionSupported = !!SpeechRecognition;
  const synthesisSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  useEffect(() => {
    if (!synthesisSupported) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length) setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, [synthesisSupported]);

  /* ---------------------------------------------------------------- listening */

  const stopLevelMeter = useCallback(() => {
    meterTokenRef.current += 1;
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    levelStampRef.current = 0;
    setAudioLevel(0);
  }, []);

  const startLevelMeter = useCallback(async () => {
    const token = ++meterTokenRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    // Recognition may have ended while the permission prompt was open.
    if (token !== meterTokenRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return; // Meter is optional: speech recognition still works.
    const ctx = new Ctor();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    ctx.createMediaStreamSource(stream).connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const now = performance.now();
      if (now - levelStampRef.current >= LEVEL_UPDATE_MS) {
        levelStampRef.current = now;
        setAudioLevel(Math.min(1, Math.sqrt(sum / data.length) * MIC_LEVEL_GAIN));
      }
      levelRafRef.current = requestAnimationFrame(tick);
    };
    levelRafRef.current = requestAnimationFrame(tick);
  }, []);

  /* ------------------------------------------------------------------ speaking */

  const silence = useCallback(() => {
    // Invalidate events from any canceled utterance, including delayed onend.
    speechTokenRef.current += 1;
    speakDoneRef.current = null;
    activeUtteranceRef.current = null;
    if (speechStartTimeoutRef.current) {
      clearTimeout(speechStartTimeoutRef.current);
      speechStartTimeoutRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    if (speechRafRef.current) {
      cancelAnimationFrame(speechRafRef.current);
      speechRafRef.current = null;
    }
    if (synthesisSupported) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }
    setIsSpeaking(false);
    setSpeechLevel(0);
  }, [synthesisSupported]);

  const speak = useCallback(
    (text, { voiceURI, rate = 1, pitch = 1, onDone } = {}) => {
      if (!synthesisSupported || !text) {
        onDone?.();
        return;
      }
      silence();
      setSpeechError(null);
      const token = ++speechTokenRef.current;

      const utter = new window.SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utter;
      if (voiceURI) {
        const match = voices.find((v) => v.voiceURI === voiceURI || v.name === voiceURI);
        if (match) utter.voice = match;
      }
      utter.rate = Math.min(2, Math.max(0.5, rate));
      utter.pitch = Math.min(2, Math.max(0.5, pitch));
      utter.volume = 1;
      speakDoneRef.current = onDone || null;

      let finished = false;
      let started = false;
      const finish = () => {
        if (finished || speechTokenRef.current !== token) return;
        finished = true;
        activeUtteranceRef.current = null;
        if (speechStartTimeoutRef.current) {
          clearTimeout(speechStartTimeoutRef.current);
          speechStartTimeoutRef.current = null;
        }
        if (keepAliveRef.current) {
          clearInterval(keepAliveRef.current);
          keepAliveRef.current = null;
        }
        if (speechRafRef.current) {
          cancelAnimationFrame(speechRafRef.current);
          speechRafRef.current = null;
        }
        setIsSpeaking(false);
        setSpeechLevel(0);
        const cb = speakDoneRef.current;
        speakDoneRef.current = null;
        cb?.();
      };

      const tickLevel = () => {
        if (finished) return;
        const now = performance.now();
        if (now - speechStampRef.current >= LEVEL_UPDATE_MS) {
          speechStampRef.current = now;
          setSpeechLevel(Math.max(0, 1 - (now - lastBoundaryRef.current) / 260));
        }
        speechRafRef.current = requestAnimationFrame(tickLevel);
      };

      utter.onstart = () => {
        if (speechTokenRef.current !== token) return;
        started = true;
        if (speechStartTimeoutRef.current) {
          clearTimeout(speechStartTimeoutRef.current);
          speechStartTimeoutRef.current = null;
        }
        setIsSpeaking(true);
        lastBoundaryRef.current = performance.now();
        speechRafRef.current = requestAnimationFrame(tickLevel);
      };
      // Word boundaries are the only real signal the browser gives us about the
      // audio it is actually playing, so the orb follows them.
      utter.onboundary = () => {
        lastBoundaryRef.current = performance.now();
      };
      utter.onend = finish;
      utter.onerror = (e) => {
        if (speechTokenRef.current !== token) return;
        const code = e?.error;
        if (code && code !== 'interrupted' && code !== 'canceled') {
          setSpeechError('Voice playback failed on this device. Responses will still appear as text.');
        }
        finish();
      };

      try {
        // Mark playback as pending immediately. Otherwise hands-free mode may
        // reopen the microphone before the asynchronous onstart event arrives.
        setIsSpeaking(true);
        window.speechSynthesis.speak(utter);
        window.speechSynthesis.resume();

        // Some browsers silently refuse playback following an async AI request
        // without a fresh user gesture. Give a visible recovery path.
        speechStartTimeoutRef.current = setTimeout(() => {
          if (speechTokenRef.current !== token || finished) return;
          if (!started) {
            setSpeechError(
              'Voice playback was blocked or did not start. Tap Test voice or Replay reply to enable audio, and check your device volume.'
            );
            finish();
            window.speechSynthesis.cancel();
          }
        }, 7000);
        keepAliveRef.current = setInterval(() => {
          if (speechTokenRef.current === token && window.speechSynthesis.speaking && window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }, 4000);
      } catch (error) {
        setSpeechError('Could not play audio. Try Test voice, check the volume, or choose another voice in Settings.');
        finish();
      }
    },
    [synthesisSupported, voices, silence]
  );

  const cancelSpeech = useCallback(() => silence(), [silence]);

  /* ----------------------------------------------------------------- listening */

  const startListening = useCallback(
    (onFinal) => {
      if (recognitionRef.current) return;
      if (!recognitionSupported) {
        setMicError('Voice input is not supported in this browser. You can still type your message.');
        return;
      }
      silence();
      setMicError(null);
      setSpeechError(null);
      setInterimTranscript('');
      onFinalRef.current = onFinal;

      // Begin recognition synchronously during the button press. Waiting for
      // getUserMedia() first loses user activation on some Android browsers.
      // The visual mic meter is optional and starts independently below.
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = navigator.language || 'en-US';

      const clearWatchdog = () => {
        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += transcript;
          else interim += transcript;
        }
        setInterimTranscript(interim);
        if (!final.trim()) return;
        clearWatchdog();
        setInterimTranscript('');
        setIsListening(false);
        recognitionRef.current = null;
        stopLevelMeter();
        try {
          recognition.stop();
        } catch (_) {}
        const cb = onFinalRef.current;
        onFinalRef.current = null;
        cb?.(final.trim());
      };

      recognition.onerror = (e) => {
        clearWatchdog();
        onFinalRef.current = null;
        recognitionRef.current = null;
        setIsListening(false);
        setInterimTranscript('');
        stopLevelMeter();
        const code = e?.error;
        if (code === 'aborted' || code === 'no-speech') return;
        setMicError(
          RECOGNITION_ERRORS[code] ||
            'Speech recognition stopped unexpectedly. Tap the microphone to try again.'
        );
      };

      recognition.onend = () => {
        clearWatchdog();
        setIsListening(false);
        setInterimTranscript('');
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
          stopLevelMeter();
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (_) {
        clearWatchdog();
        recognitionRef.current = null;
        stopLevelMeter();
        setMicError('Could not start listening. Wait a moment and tap the microphone again.');
        return;
      }
      setIsListening(true);
      // A separate meter must never prevent or delay voice transcription.
      // If permission is denied the recognizer reports the actionable error.
      startLevelMeter().catch(() => {
        if (recognitionRef.current === recognition) stopLevelMeter();
      });
      // Safety net: never leave the microphone stuck in the listening state.
      watchdogRef.current = setTimeout(() => {
        if (recognitionRef.current === recognition) {
          try {
            recognition.stop();
          } catch (_) {}
        }
      }, LISTEN_WATCHDOG_MS);
    },
    [recognitionSupported, SpeechRecognition, silence, startLevelMeter, stopLevelMeter]
  );

  const stopListening = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    onFinalRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }
    setIsListening(false);
    setInterimTranscript('');
    stopLevelMeter();
  }, [stopLevelMeter]);

  const clearErrors = useCallback(() => {
    setMicError(null);
    setSpeechError(null);
  }, []);

  // Release the microphone, the audio graph and any speech on unmount.
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        try {
          recognition.abort();
        } catch (_) {}
      }
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      if (speechStartTimeoutRef.current) clearTimeout(speechStartTimeoutRef.current);
      if (speechRafRef.current) cancelAnimationFrame(speechRafRef.current);
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    voices,
    isListening,
    isSpeaking,
    interimTranscript,
    micError,
    speechError,
    audioLevel,
    speechLevel,
    recognitionSupported,
    synthesisSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    clearErrors
  };
}