// Read-aloud support shared by the games. Speech is always best-effort:
// returns true when the utterance was handed to the browser, false when the
// browser has no speech engine – callers treat narration as optional.

// Norwegian voice tags first (nb = bokmål, nn = nynorsk), then the broader
// "no" macro tag some engines use. Everything else is treated as foreign.
function norwegianVoiceRank(lang) {
  const tag = String(lang).toLowerCase();
  if (/^nb\b|^nb-/.test(tag)) return 0;
  if (/^nn\b|^nn-/.test(tag)) return 1;
  if (/^no\b|^no-/.test(tag)) return 2;
  return -1;
}

// Pick the best installed Norwegian voice so words are pronounced in
// Norwegian instead of being mangled by an English voice reading raw text.
export function pickNorwegianVoice(voices) {
  let best = null;
  let bestRank = Infinity;
  (voices ?? []).forEach((voice) => {
    const rank = norwegianVoiceRank(voice.lang);
    if (rank !== -1 && rank < bestRank) {
      best = voice;
      bestRank = rank;
    }
  });
  return best;
}

export function speakNorwegian(text, { rate = 0.95, pitch = 1 } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  try {
    const synth = window.speechSynthesis;
    // Chrome loads its voices asynchronously – asking for them here (and on
    // voiceschanged) warms the list so later calls find a Norwegian one.
    if (typeof synth.getVoices === 'function') {
      synth.getVoices();
      synth.onvoiceschanged = () => synth.getVoices();
    }
    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    const voice = typeof synth.getVoices === 'function' ? pickNorwegianVoice(synth.getVoices()) : null;
    if (voice) utterance.voice = voice;
    utterance.lang = voice ? voice.lang : 'nb-NO';
    utterance.rate = rate;
    utterance.pitch = pitch;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
