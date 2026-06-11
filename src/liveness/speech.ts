// ---------------------------------------------------------------------------
// Speech synthesis — female voice narration for liveness instructions
//
// Chrome has multiple known bugs with speechSynthesis:
// 1. speak() requires user activation for the first call
// 2. cancel() followed by speak() silently fails
// 3. Synthesis gets stuck in "paused" state after cancel/tab switch
// This module works around all of them.
// ---------------------------------------------------------------------------

import type { VoiceGuidanceOption } from '../types/config';

let preferredVoice: SpeechSynthesisVoice | null = null;
let voiceResolved = false;
let primed = false;

// ---------------------------------------------------------------------------
// Runtime voice-guidance configuration
//
// Set once per session from the SDK config (see configureSpeech). When disabled,
// speak()/primeSpeech() become no-ops so the liveness flow runs silently. The
// `language` selects the spoken voice/lang; the text itself still mirrors the
// on-screen instruction (localized strings are a planned follow-up).
// ---------------------------------------------------------------------------

let speechEnabled = true;
let speechLanguage = 'en-US';

/** Normalize the public `voiceGuidance` prop (boolean | object | undefined). */
export function resolveVoiceGuidance(
  option?: VoiceGuidanceOption,
): { enabled: boolean; language: string } {
  if (option === undefined) return { enabled: true, language: 'en-US' };
  if (typeof option === 'boolean') return { enabled: option, language: 'en-US' };
  return { enabled: option.enabled ?? true, language: option.language ?? 'en-US' };
}

/** Apply the resolved voice-guidance config for the rest of the session. */
export function configureSpeech(option?: VoiceGuidanceOption): void {
  const { enabled, language } = resolveVoiceGuidance(option);
  speechEnabled = enabled;
  // Changing language invalidates the cached voice pick.
  if (language !== speechLanguage) {
    speechLanguage = language;
    voiceResolved = false;
    preferredVoice = null;
  }
  if (!enabled) stopSpeaking();
}

/** Whether spoken guidance is currently enabled. */
export function isSpeechEnabled(): boolean {
  return speechEnabled;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  return window.speechSynthesis;
}

function resolveVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;

  const voices = s.getVoices();
  if (voices.length === 0) {
    voiceResolved = false;
    return null;
  }
  if (voiceResolved) return preferredVoice;

  const femaleKeywords = ['female', 'woman', 'samantha', 'karen', 'moira', 'fiona', 'victoria', 'zira', 'hazel'];
  // Prefer voices for the configured language (e.g. 'en', 'fr'); fall back to all.
  const langPrefix = speechLanguage.slice(0, 2).toLowerCase();
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  const englishVoices = langVoices.length > 0 ? langVoices : voices;

  const female = englishVoices.find((v) => {
    const name = v.name.toLowerCase();
    return femaleKeywords.some((kw) => name.includes(kw));
  });
  if (female) { preferredVoice = female; voiceResolved = true; return female; }

  const googleFemale = englishVoices.find((v) =>
    v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('female'),
  );
  if (googleFemale) { preferredVoice = googleFemale; voiceResolved = true; return googleFemale; }

  if (englishVoices.length > 0) { preferredVoice = englishVoices[0]; voiceResolved = true; return englishVoices[0]; }

  // Fallback: any voice
  if (voices.length > 0) { preferredVoice = voices[0]; voiceResolved = true; return voices[0]; }

  voiceResolved = true;
  return null;
}

// Eagerly load voices
if (synth()) {
  synth()!.getVoices();
  if (synth()!.onvoiceschanged !== undefined) {
    synth()!.onvoiceschanged = () => { voiceResolved = false; resolveVoice(); };
  }
}

// Chrome resume workaround — periodically resume to prevent stuck state
let resumeInterval: ReturnType<typeof setInterval> | null = null;

function startResumeWorkaround(): void {
  stopResumeWorkaround();
  resumeInterval = setInterval(() => {
    const s = synth();
    if (s && s.speaking && !s.paused) {
      // Intentionally empty — the interval itself keeps Chrome from pausing
    } else if (s && s.paused) {
      s.resume();
    }
  }, 5000);
}

function stopResumeWorkaround(): void {
  if (resumeInterval) {
    clearInterval(resumeInterval);
    resumeInterval = null;
  }
}

let pendingText: string | null = null;
let speakTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Prime speech synthesis — must be called from a user gesture (click/tap).
 * After priming, all subsequent speak() calls work even from async contexts.
 */
export function primeSpeech(): void {
  if (!speechEnabled) return;
  const s = synth();
  if (!s || primed) return;

  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  utterance.rate = 10;
  s.speak(utterance);
  primed = true;
}

/**
 * Speak the given text. Cancels any ongoing speech.
 */
export function speak(text: string): void {
  if (!speechEnabled) return;
  const s = synth();
  if (!s) return;

  // Clear pending
  if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
  pendingText = text;

  // Unstick Chrome
  if (s.paused) s.resume();
  s.cancel();

  // Delay after cancel to avoid Chrome silent-fail bug
  speakTimer = setTimeout(() => {
    speakTimer = null;
    const s2 = synth();
    if (!s2 || pendingText !== text) return; // superseded by newer call

    // Unstick again just in case
    if (s2.paused) s2.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;
    utterance.lang = speechLanguage;

    const voice = resolveVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => stopResumeWorkaround();
    utterance.onerror = (ev) => {
      stopResumeWorkaround();
      // Retry once on 'interrupted' or 'canceled' — Chrome sometimes fires
      // these spuriously after a cancel() even with the delay.
      if (ev.error === 'interrupted' || ev.error === 'canceled') {
        const s3 = synth();
        if (s3 && pendingText === text) {
          const retry = new SpeechSynthesisUtterance(text);
          retry.rate = 1.0;
          retry.pitch = 1.1;
          retry.volume = 1.0;
          retry.lang = speechLanguage;
          if (voice) retry.voice = voice;
          retry.onend = () => stopResumeWorkaround();
          retry.onerror = () => stopResumeWorkaround();
          s3.speak(retry);
          startResumeWorkaround();
        }
      }
    };

    s2.speak(utterance);
    startResumeWorkaround();
  }, 150);
}

/**
 * Stop any ongoing speech.
 */
export function stopSpeaking(): void {
  if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
  pendingText = null;
  stopResumeWorkaround();
  const s = synth();
  if (!s) return;
  s.cancel();
}
