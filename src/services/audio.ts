// Audio service handling the user-provided greeting, countdown tones, and speech fallback

let currentAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playGreetingAudio(
  customUrl?: string | null,
  volume: number = 1.0,
  onEnd?: () => void
): Promise<void> {
  return new Promise((resolve) => {
    stopGreetingAudio();

    const audioUrl = customUrl || '/greeting.wav';
    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    currentAudio = audio;

    let finished = false;
    const finalize = () => {
      if (finished) return;
      finished = true;
      if (onEnd) onEnd();
      resolve();
    };

    audio.onended = finalize;
    audio.onerror = () => {
      console.warn('Audio element error, falling back to Web Speech synthesis');
      playFallbackSpeech(volume).then(finalize);
    };

    audio.play().catch((err) => {
      console.warn('Autoplay blocked or playback failed:', err);
      // Try Web Speech API fallback
      playFallbackSpeech(volume).then(finalize);
    });
  });
}

export function stopGreetingAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// Fallback Indonesian speech synthesis
export function playFallbackSpeech(volume: number = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const text = 'Halo, selamat datang di Memore Audio Visual Guestbook. Silakan angkat gagang telepon, lalu dengarkan instruksinya.';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = volume;

    // Pick best Indonesian voice if available
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('ID'));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

// Play countdown beep tone (Web Audio API)
export function playCountdownBeep(isFinal: boolean = false): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isFinal ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, ctx.currentTime); // A5 or A4

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isFinal ? 0.35 : 0.15));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + (isFinal ? 0.35 : 0.15));
  } catch (err) {
    console.debug('Web audio tone failed:', err);
  }
}

// Play vintage telephone mechanical click / bell ring
export function playVintageClick(): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
}
