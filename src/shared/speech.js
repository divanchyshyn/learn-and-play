// Read-aloud support shared by the games. Speech is always best-effort:
// returns true when the utterance was handed to the browser, false when the
// browser has no speech engine – callers treat narration as optional.
export function speakNorwegian(text, { rate = 0.95, pitch = 1 } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'nb-NO';
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
