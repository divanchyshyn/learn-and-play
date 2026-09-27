import { useEffect, useRef, useState } from 'react';
import { KEY_TURN_DEGREES, angleStep, pointerAngle } from './rig.js';

// The one control on the water, changing with what the child can do right now:
//   * "Kast ut"     – put the line out: the bait goes down under the boat
//   * "Dra opp"     – take the line up again while the float lies waiting
//   * "Napp!"       – the float is under: strike, right now
//   * the reel      – a fish is hooked: draw circles round the spool to wind in
//
// It is deliberately one button in one place in the thumb's reach, so a child
// never has to find a different control for every step of the trip.

// The reel. Drawing a finger in circles around the spool winds the fish in, and
// that is the whole fight: nothing beside the spool has to be watched while the
// child spins, and a hooked fish is never lost, only brought in.
// The dead zone keeps the maths kind: a finger passing right across the spool's
// centre covers a huge angle in one move, so those moves are ignored rather than
// counted as a turn.
export const DEAD_ZONE = 0.15;

// The angle of a finger around the spool's centre, in degrees, or null while the
// finger is inside the dead zone. The reel hands in the spool's own box and the
// finger's position; everything else is arithmetic.
export function reelAngle(rect, point) {
  const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const radius = Math.hypot(point.clientX - centre.x, point.clientY - centre.y);
  if (radius < Math.min(rect.width, rect.height) * DEAD_ZONE) return null;
  return pointerAngle({ x: point.clientX, y: point.clientY }, centre);
}

function Reel({ fight, onTurn }) {
  const angle = fight ? fight.angle : 0;
  const [turning, setTurning] = useState(false);
  const lastAngle = useRef(null);
  // How far the finger has turned since it went down. A drag leaves a click
  // behind when it ends, and that click must not count as a second, tapped turn.
  const dragged = useRef(0);

  // A finger lifted anywhere, or a window that loses focus, ends the turn: the
  // reel never keeps winding by itself.
  useEffect(() => {
    if (!turning) return undefined;
    const release = () => {
      lastAngle.current = null;
      setTurning(false);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [turning]);

  // Every pointer move counts the angle the finger covered since the last one
  // and passes it on; the sea tick turns those degrees into line wound in.
  function continueTurn(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (lastAngle.current === null) {
      lastAngle.current = reelAngle(rect, event);
      return;
    }
    const current = reelAngle(rect, event);
    if (current === null) {
      lastAngle.current = null;
      return;
    }
    const step = angleStep(lastAngle.current, current);
    lastAngle.current = current;
    if (step !== 0) {
      dragged.current += Math.abs(step);
      onTurn(step);
    }
  }

  function endTurn() {
    lastAngle.current = null;
    setTurning(false);
  }

  // A plain tap on the spool turns one deliberate quarter, the same as an arrow
  // key. Enter, Space, a switch and a screen reader all reach a button as this
  // same click, so one path serves every way of winding without a drag. A
  // gesture that already turned the spool leaves no extra quarter behind.
  function tapTurn() {
    if (dragged.current < KEY_TURN_DEGREES) onTurn(KEY_TURN_DEGREES);
    dragged.current = 0;
  }

  return <div className={`reel${turning ? ' turning' : ''}`}>
    <button
      type="button"
      className="reel-spool"
      aria-label="Sveiv inn fisken: dra fingeren rundt hjulet, trykk piltastene eller trykk på hjulet"
      onPointerDown={(event) => {
        // Keep the finger: a child's thumb drifts while it draws circles, and
        // the reel should not let go of the line just because it slid off the
        // spool. (jsdom and older browsers have no capture – the up/cancel
        // handlers below still end the turn there.)
        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* no capture support */ }
        dragged.current = 0;
        lastAngle.current = reelAngle(event.currentTarget.getBoundingClientRect(), event);
        setTurning(true);
      }}
      onPointerMove={continueTurn}
      onPointerUp={endTurn}
      onPointerCancel={endTurn}
      onPointerLeave={(event) => {
        // A captured pointer keeps turning outside the spool; a plain pointer
        // that leaves with the button still down is done, exactly as before.
        if (!event.buttons) endTurn();
      }}
      onClick={tapTurn}
      onKeyDown={(event) => {
        const step = event.key === 'ArrowLeft' ? -KEY_TURN_DEGREES
          : event.key === 'ArrowRight' ? KEY_TURN_DEGREES : 0;
        if (step === 0) return;
        event.preventDefault();
        // Key repeat would spin the reel far too fast to steer – each press is
        // one deliberate quarter turn.
        if (event.repeat) return;
        onTurn(step);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="reel-handle" aria-hidden="true" style={{ rotate: `${angle}deg` }} />
      <span className="reel-label" aria-hidden="true">{turning ? 'Sveiv!' : 'Drei'}</span>
    </button>
  </div>;
}

export function ActionBar({ stage, fight, onCast, onPullIn, onStrike, onTurn }) {
  if (stage === 'fight') return <div className="action-bar"><Reel fight={fight} onTurn={onTurn} /></div>;
  if (stage === 'bite') {
    return <div className="action-bar">
      <button type="button" className="action-button bite-button" onClick={onStrike} aria-label="Napp! Trykk for å feste kroken">
        Napp! <span aria-hidden="true">❗</span>
      </button>
    </div>;
  }
  if (stage === 'bait') {
    return <div className="action-bar">
      <button type="button" className="action-button" onClick={onPullIn}>
        Dra opp <span aria-hidden="true">⬆</span>
      </button>
    </div>;
  }
  if (stage !== 'sail') return null;
  return <div className="action-bar">
    <button type="button" className="action-button cast-button" onClick={onCast}>
      Kast ut <span aria-hidden="true">🎣</span>
    </button>
  </div>;
}
