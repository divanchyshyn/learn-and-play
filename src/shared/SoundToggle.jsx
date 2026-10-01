// The collection's one speaker button, so the same control cannot end up with
// two different accessible contracts. `className` lets a game keep its own skin
// (the shop and Kortkrig style it as `.chip.toggle`, the others as `.chip`).
//
// The button is a toggle rather than a label: `aria-pressed` tells a screen
// reader that the sound is off, and the label says what the press will do.
export function SoundToggle({ soundOn, onToggle, className = 'chip' }) {
  return <button
    className={className}
    type="button"
    aria-pressed={!soundOn}
    aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'}
    onClick={onToggle}
  >
    {soundOn ? '🔊' : '🔇'}
  </button>;
}
