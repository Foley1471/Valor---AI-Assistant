# Valor voice playback — manual verification

The first voice implementation uses the browser Web Speech API (speech recognition and speech synthesis).
It is not yet a real-time speech-to-speech connection. Voice availability, installed voices, autoplay rules,
and support for recognition vary by browser and device.

## Deploy / publish

1. Review and merge the GitHub pull request when ready.
2. Allow Base44 GitHub sync to bring the changes into the Builder.
3. **Publish** the updated Base44 app from its dashboard (Git sync alone may not publish changes).
4. Reopen or refresh the published app on your device.

## Reproduce and test on Google Pixel Tablet + Chrome

1. Dock the Pixel Tablet; confirm its output volume is audible and the expected audio output is selected.
2. Open Valor over HTTPS, sign in, and complete onboarding.
3. Tap **Test voice**. You should hear: "Greetings, my friend. Valor voice is ready."
4. Tap **Talk**, allow the microphone when prompted, and say "What is two plus two?"
5. Confirm the recognized message appears, a real AI text reply arrives, and it is spoken aloud.
6. If the message arrives silently, tap **Replay reply**. This forces playback from a user gesture.
7. Tap **Stop** while speech is underway; audio and the speaking orb state should stop promptly.
8. Tap **Voice mode** and speak two questions in succession, with a pause between turns.
9. Deny microphone permission and confirm an actionable notice appears without repeated prompts.
10. Try a different voice in Settings if the selected voice is missing or silent.

Repeat steps 3–7 in Windows Chrome or Edge. Also test the first-time greeting on a fresh account.

## Opera GX investigation and recognition recovery

On macOS Opera GX 135 (Chromium 151), the published app exposes a native
`SpeechRecognition` constructor, but the observed session produced no start,
result, error, or end event. Microphone permission was allowed, and a typed
message received an AI reply. Constructor availability alone therefore does
not establish that the browser's recognition service works.

The recovery patch bounds startup to 10 seconds and the complete recognition
session to 25 seconds. Both deadlines clear listening state, abort the recognizer,
release the meter, and show guidance without waiting for a browser end event.
No-speech, no-match, and empty-end events also show feedback and stop hands-free
retry loops. Events from an old session cannot reset a newer session.

Run `node tests/voice-lifecycle.cjs` for mocked regression coverage. On a device,
confirm a stalled recognizer exits with a message, Stop cancels pending timeouts,
and successful speech still reaches the AI once. Chrome remains the working
voice-input path reported by the user; this patch does not add a transcription
service for Opera or establish that native recognition works there.

## What the fix changes

- Starts speech recognition inside the user's tap handler (rather than awaiting an independent
  microphone-level meter that can lose the browser's transient user activation).
- Keeps the optional microphone level meter from blocking recognition.
- Uses speech playback identifiers so canceled utterances cannot fire stale completion events.
- Marks speech as pending immediately, preventing continuous voice mode from reopening the
  microphone while speech playback is starting.
- Shows a recovery message if speech does not start, plus Test voice / Replay reply controls.
- Stops hands-free retries on voice errors and releases audio resources when finished.

## Limitations / follow-up

- Browsers may restrict automatic speech playback after asynchronous work; the explicit playback
  buttons are the recovery path. There is no supported way to bypass browser restrictions.
- Some browsers do not provide Web Speech recognition; text chat remains usable.
- The speaking orb is synchronized with speech events and boundaries, **not** a raw outgoing
  audio waveform. Pixel-perfect lip/audio synchronization would require a different voice stack.
- The AI backend, smart home integrations, and native Android/Windows assistants are outside this patch.
- This change was reviewed at source level. Actual playback and microphone access **must**
  be checked on physical devices; static review cannot prove audible output.
