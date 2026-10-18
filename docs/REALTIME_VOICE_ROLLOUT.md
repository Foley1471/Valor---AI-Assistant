# Ellie voice integration

This adds a separate AI voice mode using OpenAI Realtime and the Marin voice (displayed as Ellie), alongside the existing browser voice and text chat. The production API key stays on the server. The browser sends microphone audio directly to OpenAI over WebRTC after explicit paid-use consent and a button press. Each session starts fresh; displayed transcripts are not saved to Valor History. Existing text conversation behavior is preserved.

## Current state

Implementation is pushed in PR #3; Base44 preview import is underway. Publication is pending. A dedicated production key has been saved in the private, Git-ignored `.env.production.local`; it has NOT been installed in Base44. Never upload that file or paste its contents into builder chat, GitHub, or logs. Base44 GitHub sync was disconnected when last checked; merging alone does not verify import or publication.

## Configuration required before activation

1. User approved necessary changes, pushing, and publication on October 18, 2026. Complete verification before publishing.
2. Import the VoiceSession entity and both backend functions, including `valor-voice/service.js`, along with frontend changes. Confirm runtime support for `base44:runtime` secrets and background work in the target app. Build and test in Base44 preview.
3. Install the dedicated key in Base44's backend secret `OPENAI_API_KEY` through its secure secret controls. Check whether this name already exists and is used by other functions before replacing any value. Existing `valorAI` must continue to work. Do not use any `VITE_` variable for this key.
4. Set `VALOR_VOICE_ENABLED=false` initially. Set `VALOR_VOICE_ALLOWED_USER_IDS` to the owner's authenticated Base44 user ID only, not email. Empty allowlist denies everyone.
5. Choose `VALOR_VOICE_MODEL=gpt-realtime-2.1` (Quality, default) or `gpt-realtime-2.1-mini` (Economy). Confirm production project access before starting a paid test. Voice is fixed to `marin`.
6. Set `VALOR_VOICE_DAILY_SESSIONS=5` or a smaller initial allowance. The cleanup endpoint requires an authenticated admin; it does not use a shared secret.
7. Configure a Workflow triggered only when VoiceSession transitions to active, with a durable PT3M wait followed by `valor-voice-cleanup`, invoked as the admin creator. Validate entity naming, retry behavior, and admin authentication in Base44. Confirm anonymous/non-admin requests fail and expired active calls are actually hung up. Do not enable paid sessions until this workflow is validated. Base44 recurring schedules have a five-minute minimum; the entity-triggered workflow avoids continuous polling.
8. Enable voice for the owner in preview, test with short paid sessions in Opera GX, Chrome, and the Pixel Tablet. Check playback, transcription, interruptions, Stop, timeout, hiding the tab, switching modes, denied microphone permission, quota errors, and continued text chat. Inspect upstream usage and active-call cleanup.
9. Publish after preview checks pass under the user's approval. Verify the public app after publishing; do not infer publication from a successful build.

## Limits and operational requirements

The client stops after three minutes and the backend attempts hangup after three minutes. Background work is best effort; workflow cleanup is required as another safeguard. Network loss or worker interruptions can delay hangup. The current database allowance check is not transactional: concurrent requests can race. It is suitable only for an initial trusted-owner trial, not a public paid-voice rollout or a guaranteed spending cap. Broader access requires an atomic reservation/locking mechanism and concurrency testing. Workflow cleanup processes up to 500 active and 500 starting rows per run; monitor backlog and add pagination before scaling.

Realtime billing includes audio and text tokens. Displaying user transcripts also uses `gpt-4o-mini-transcribe`. Earlier transcription-only hourly estimates do not apply to full realtime conversations. OpenAI project budget notifications are not guaranteed hard spending caps. Keep automatic credit reload off if desired and monitor the actual API Usage dashboard.

Session rows contain ownership, state, timestamps, and upstream call ID, not audio or transcripts. Ordinary users have no direct entity permissions; authenticated backend handlers verify ownership. OpenAI's own retention policies still apply. Add session-row retention before broader rollout.

## Local validation

Run `node --test tests/realtime-voice.test.mjs` for mocked authentication, ownership, allowance, consent, safe errors, microphone release, restart, and pending-connection cancellation. No paid API calls are made by those tests. Run existing voice lifecycle tests, lint, and frontend build. The repository has 60 existing TypeScript diagnostics; compare against baseline and report any additions. Local build without Base44 app environment confirms compilation only, not deployment functionality.
