import { useEffect, useRef, useState } from 'react';
import { KEY_TURN_DEGREES, angleStep, pointerAngle, tensionLevel, tensionPercent } from './rig.js';

// The one control on the water, changing with what the child can do right now:
//   * "Kast ut"     – put the line out: the bait goes down under the boat
//   * "Dra opp"     – take the line up again while the float lies waiting
//   * "Napp!"       – the float is under: strike, right now
//   * the reel      – a fish is hooked: draw circles round the spool to wind in
//
// It is deliberately one button in one place in the thumb's reach, so a child
// never has to find a different control for every step of the trip.

// The reel. Drawing a finger in circles around the spool winds the fish in and
// tightens the line; leaving it alone eases the line and gives a little of it
// back. The tension bar stands beside the spool, out from under the thumb that
// turns it: it fills from the bottom and turns from green to amber to red as the
// line tightens, and at red the line is about to give – that is the whole lesson
// of the fight.
// The dead zone keeps the maths kind: a finger passing right across the spool's
// centre covers a huge angle in one move, so those moves are ignored rather than
// counted as a turn.
const DEAD_ZONE = 0.15;

function reelAngle(element, event) {
  const rect = element.getBoundingClientRect();
  const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const point = { x: event.clientX, y: event.clientY };
  const radius = Math.hypot(point.x - centre.x, point.y - centre.y);
  if (radius < Math.min(rect.width, rect.height) * DEAD_ZONE) return null;
  return pointerAngle(point, centre);
}

function ReelCrank({ fight, onTurn }) {
  const tension = fight ? fight.tension : 0;
  const level = tensionLevel(tension);
  const fill = tensionPercent(tension);
  const angle = fight ? fight.angle : 0;
  const [turning, setTurning] = useState(false);
  const lastAngle = useRef(null);

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
  // and passes it on; the sea tick turns those degrees into line and tension.
  function continueTurn(event) {
    if (lastAngle.current === null) {
      lastAngle.current = reelAngle(event.currentTarget, event);
      return;
    }
    const current = reelAngle(event.currentTarget, event);
    if (current === null) {
      lastAngle.current = null;
      return;
    }
    const step = angleStep(lastAngle.current, current);
    lastAngle.current = current;
    if (step !== 0) onTurn(step);
  }

  function endTurn() {
    lastAngle.current = null;
    setTurning(false);
  }

  return <div className={`reel${turning ? ' turning' : ''}`} data-level={level}>
    <div className="tension-meter" aria-hidden="true">
      <div className="tension-fill" style={{ height: `${fill}%` }} />
    </div>
    <button
      type="button"
      className="reel-crank"
      aria-label="Sveiv inn fisken: dra fingeren rundt hjulet eller trykk piltastene, og slipp når linjen strammer"
      onPointerDown={(event) => {
        // Keep the finger: a child's thumb drifts while it draws circles, and
        // the reel should not let go of the line just because it slid off the
        // spool. (jsdom and older browsers have no capture – the up/cancel
        // handlers below still end the turn there.)
        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* no capture support */ }
        lastAngle.current = reelAngle(event.currentTarget, event);
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
      <span className="crank-handle" aria-hidden="true" style={{ rotate: `${angle}deg` }} />
      <span className="crank-label" aria-hidden="true">{turning ? 'Sveiv!' : 'Drei'}</span>
    </button>
    {level === 'danger' && <span className="reel-warning" aria-hidden="true">Slipp!</span>}
    {level === 'slack' && <span className="reel-warning slack-warning" aria-hidden="true">Drei!</span>}
  </div>;
}

export function ActionBar({ stage, fight, onCast, onPullIn, onStrike, onTurn }) {
  if (stage === 'fight') return <div className="action-bar"><ReelCrank fight={fight} onTurn={onTurn} /></div>;
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
