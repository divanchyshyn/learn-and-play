import { useEffect } from 'react';
import { tensionLevel, tensionPercent } from './rig.js';

// The one control on the water, changing with what the child can do right now:
//   * "Kast ut"     – put the line out: the bait goes down under the boat
//   * "Dra opp"     – take the line up again while the float lies waiting
//   * "Napp!"       – the float is under: strike, right now
//   * the crank      – a fish is hooked: hold to wind it in
//
// It is deliberately one button in one place in the thumb's reach, so a child
// never has to find a different control for every step of the trip.

// The crank. Holding it winds the fish in and tightens the line; letting go
// eases the line and gives a little of it back. The tension bar stands beside
// the button, out from under the thumb that holds the crank: it fills from the
// bottom and turns from green to amber to red as the line tightens, and at red
// the line is about to give – that is the whole lesson of the fight.
function ReelCrank({ fight, onHoldChange }) {
  const holding = Boolean(fight && fight.holding);
  const tension = fight ? fight.tension : 0;
  const level = tensionLevel(tension);
  const fill = tensionPercent(tension);

  // A finger lifted anywhere, or a window that loses focus, releases the crank:
  // the line can never be held on by accident.
  useEffect(() => {
    if (!holding) return undefined;
    const release = () => onHoldChange(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [holding, onHoldChange]);

  return <div className={`reel${holding ? ' holding' : ''}`} data-level={level}>
    <div className="tension-meter" aria-hidden="true">
      <div className="tension-fill" style={{ height: `${fill}%` }} />
    </div>
    <button
      type="button"
      className="reel-crank"
      aria-label="Sveiv inn fisken: hold for å sveive, slipp når linjen strammer"
      onPointerDown={(event) => {
        // Keep the finger: a child's thumb drifts a little while it winds, and
        // the crank should not let go of the line just because it slid off the
        // button. (jsdom and older browsers have no capture – the leave/up
        // handlers below still release it there.)
        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* no capture support */ }
        onHoldChange(true);
      }}
      onPointerUp={() => onHoldChange(false)}
      onPointerCancel={() => onHoldChange(false)}
      onPointerLeave={() => onHoldChange(false)}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) onHoldChange(true);
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') onHoldChange(false);
      }}
      onBlur={() => onHoldChange(false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="crank-handle" aria-hidden="true" />
      <span className="crank-label" aria-hidden="true">{holding ? 'Sveiv!' : 'Hold'}</span>
    </button>
    {level === 'danger' && <span className="reel-warning" aria-hidden="true">Slipp!</span>}
    {level === 'slack' && <span className="reel-warning slack-warning" aria-hidden="true">Stram!</span>}
  </div>;
}

export function ActionBar({ stage, fight, onCast, onPullIn, onStrike, onHoldChange }) {
  if (stage === 'fight') return <div className="action-bar"><ReelCrank fight={fight} onHoldChange={onHoldChange} /></div>;
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
