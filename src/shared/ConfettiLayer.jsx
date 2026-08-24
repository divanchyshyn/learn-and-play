import { useMemo } from 'react';
import './confetti.css';

// The collection's celebration palette – warm, playful, high contrast.
const CONFETTI_COLORS = ['#e46e4b', '#0c9fc4', '#d09b45', '#e5ae45', '#63a375'];

// Purely decorative falling confetti. Render it while a game is celebrating;
// it hides from assistive tech and never catches pointer events.
export function ConfettiLayer({ count = 34 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.4 + Math.random() * 1.6,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    spin: `${Math.round((Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360))}deg`,
    round: Math.random() > 0.5,
  })), [count]);
  return <div className="confetti-layer" aria-hidden="true">
    {pieces.map((piece) => <span
      className={`confetti-piece${piece.round ? ' round' : ''}`}
      key={piece.id}
      style={{ left: `${piece.left}%`, backgroundColor: piece.color, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`, '--spin': piece.spin }}
    />)}
  </div>;
}
