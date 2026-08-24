import { useEffect, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { speakNorwegian } from '../../shared/speech.js';
import { LINE_MAX, LINE_MIN, clampToLine, needsAdjust, tapToValue } from './line.js';
import { nextProblem, problemAnswer, problemSpeech, problemText } from './problems.js';
import { isMuted, setMuted as setAudioMuted, sounds } from './sounds.js';

// The little story every round tells, and how long each beat lasts. Exported
// so the tests (and the CSS hop/transition durations) stay in step.
export const TIMING = { HOP_MS: 700, REVEAL_MS: 900, ADJUST_MS: 450, CELEBRATE_MS: 1600 };
const PHASE_MS = { hopping: TIMING.HOP_MS, revealing: TIMING.REVEAL_MS, adjusting: TIMING.ADJUST_MS, celebrating: TIMING.CELEBRATE_MS };

// Ticks every 5 keep the line readable; labels sit on every 10.
const TICK_VALUES = Array.from({ length: 21 }, (_, index) => index * 5);
const LABEL_VALUES = TICK_VALUES.filter((value) => value % 10 === 0);

// The journey's one traveller. Decorative – the strip itself is the control.
function FrogSprite() {
  return <svg className="frog-sprite" viewBox="0 0 64 54" aria-hidden="true">
    <ellipse className="frog-leg" cx="15" cy="46" rx="11" ry="6" />
    <ellipse className="frog-leg" cx="49" cy="46" rx="11" ry="6" />
    <ellipse className="frog-belly" cx="32" cy="36" rx="21" ry="13" />
    <ellipse className="frog-body" cx="32" cy="29" rx="24" ry="17" />
    <circle className="frog-eye" cx="22" cy="12" r="8" />
    <circle className="frog-eye" cx="42" cy="12" r="8" />
    <circle className="frog-pupil" cx="22" cy="11" r="3.4" />
    <circle className="frog-pupil" cx="42" cy="11" r="3.4" />
    <circle className="frog-cheek" cx="13" cy="25" r="3.4" />
    <circle className="frog-cheek" cx="51" cy="25" r="3.4" />
    <path className="frog-smile" d="M 24 24 Q 32 31 40 24" />
  </svg>;
}

// Neutral phase narration for screen readers (and a calm map of the flow).
function statusFor(phase, answer) {
  if (phase === 'ready') return 'Se på regnestykket og trykk på tallinja der du tror svaret bor.';
  if (phase === 'hopping') return 'Frosken hopper!';
  if (phase === 'revealing') return `Flagget viser at svaret bor på ${answer}.`;
  if (phase === 'adjusting') return `Vi lander sammen på ${answer}.`;
  return `Framme ved ${answer}!`;
}

export function Tierhopp() {
  // One continuous journey: the frog starts at 0 and simply stays wherever
  // it last landed when the next problem appears.
  const [problem, setProblem] = useState(() => nextProblem(null));
  const [position, setPosition] = useState(LINE_MIN);
  const [phase, setPhase] = useState('ready'); // ready -> hopping -> revealing -> adjusting? -> celebrating -> ready …
  const [tap, setTap] = useState(null); // where the player pointed this round
  const [aim, setAim] = useState(null); // keyboard aim marker
  const [hopCount, setHopCount] = useState(0); // restarts the jump animation each hop
  const [soundOn, setSoundOn] = useState(!isMuted());

  const answer = problemAnswer(problem);

  // Each non-ready phase schedules exactly one continuation; changing phase
  // (or unmounting) clears the pending timer first.
  useEffect(() => {
    if (phase === 'ready') return undefined;
    if (phase === 'celebrating') sounds.cheer();
    const timer = window.setTimeout(() => {
      if (phase === 'hopping') {
        sounds.land();
        setPhase('revealing');
      } else if (phase === 'revealing') {
        // A near-enough tap already counts as landed; otherwise the frog
        // does its small "let's land exactly here" hop to the flag.
        if (tap !== null && needsAdjust(tap, answer)) {
        setPosition(answer);
        setHopCount((count) => count + 1);
          setPhase('adjusting');
      } else {
          setPhase('celebrating');
      }
      } else if (phase === 'adjusting') {
        setPhase('celebrating');
      } else {
    setProblem((current) => nextProblem(current));
    setTap(null);
    setAim(null);
    setPhase('ready');
  }
    }, PHASE_MS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, tap, answer]);

  function hopTo(value) {
    sounds.hop();
    setTap(value);
    setPosition(clampToLine(value));
    setHopCount((count) => count + 1);
    setAim(null);
    setPhase('hopping');
  }

  function handleStripTap(event) {
    if (phase !== 'ready') return;
    const rect = event.currentTarget.getBoundingClientRect();
    hopTo(tapToValue(event.clientX - rect.left, rect.width));
  }

  function handleStripKeyDown(event) {
    if (phase !== 'ready') return;
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      setAim((current) => clampToLine((current ?? position) + direction * step));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setAim(event.key === 'Home' ? LINE_MIN : LINE_MAX);
    } else if ((event.key === 'Enter' || event.key === ' ') && aim !== null) {
      event.preventDefault();
      hopTo(aim);
    }
  }

  function hearProblem() {
    speakNorwegian(problemSpeech(problem), { rate: 0.85 });
  }

  function restartJourney() {
    sounds.select();
    setProblem((current) => nextProblem(current));
    setPosition(LINE_MIN);
    setTap(null);
    setAim(null);
    setPhase('ready');
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.select();
  }

  const airborne = phase === 'hopping' || phase === 'adjusting';
  const resolved = tap !== null && phase !== 'ready';
  const showAnswer = phase === 'revealing' || phase === 'adjusting' || phase === 'celebrating';

  return <main className="game-page hop-page">
    <GameHeader title="Tierhopp">
      <p className="hop-intro">
        Frosken skal hoppe langs tallinja fra 0 til 100. Se på regnestykket og trykk der du tror den skal lande –
        så hjelper vi den helt fram. Alle hopper er gode hopper, og det er aldri noe hast.
      </p>
      <div className="game-controls">
        <button className="chip" type="button" onClick={restartJourney}>Nytt spor 🔄</button>
        <button
          className="chip"
          type="button"
          aria-pressed={!soundOn}
          aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'}
          onClick={toggleSound}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </GameHeader>

    <section className="hop-stage" aria-label="Tallinjespill">
      <div className="problem-card" aria-live="polite">
        {resolved
          ? <p className="problem-sum">{problemText(problem)} = <strong className="sum-answer">{answer}</strong></p>
          : <p className="problem-sum">{problemText(problem)}</p>}
        <button className="hear-button" type="button" onClick={hearProblem} aria-label="Hør regnestykket">
          <span aria-hidden="true">🔊</span>
        </button>
        <p className="problem-hint">{resolved ? 'Flagget viser hvor svaret bor.' : 'Hvor skal frosken hoppe? Trykk på tallinja.'}</p>
      </div>

      <div
        className={`number-strip phase-${phase}`}
        role="group"
        aria-label={`Tallinja fra ${LINE_MIN} til ${LINE_MAX}. Trykk der du tror svaret bor.`}
        tabIndex={0}
        onClick={handleStripTap}
        onKeyDown={handleStripKeyDown}
      >
        <div className="tick-track" aria-hidden="true">
          {TICK_VALUES.map((value) => (
            <span key={value} className={`tick${value % 10 === 0 ? ' major' : ''}`} style={{ left: `${value}%` }} />
          ))}
          {LABEL_VALUES.map((value) => (
            <span key={`label-${value}`} className="tick-label" style={{ left: `${value}%` }}>{value}</span>
          ))}
        </div>

        <span className="meadow flower-a" aria-hidden="true">🌼</span>
        <span className="meadow grass-b" aria-hidden="true">🌿</span>
        <span className="meadow flower-c" aria-hidden="true">🌸</span>

        {aim !== null && phase === 'ready' && (
          <span className="aim-marker" style={{ left: `${aim}%` }} aria-hidden="true" />
        )}

        {showAnswer && (
          <span className="answer-flag" style={{ left: `${answer}%` }} aria-hidden="true">
            <span className="flag-number">{answer}</span>
            <span className="flag-pole" />
            <span className="flag-cloth" />
          </span>
        )}

        <div className="frog" style={{ left: `${position}%`, '--travel': phase === 'hopping' ? `${TIMING.HOP_MS}ms` : phase === 'adjusting' ? `${TIMING.ADJUST_MS}ms` : '0ms' }}>
          <div className={`frog-hop${airborne ? ' airborne' : ''}`} key={hopCount}>
            <FrogSprite />
          </div>
        </div>
      </div>

      {phase === 'celebrating' && <>
        <ConfettiLayer count={30} />
        <div className="cheer-banner" aria-hidden="true">🎉 Framme!</div>
      </>}

      <p className="visually-hidden" role="status">{statusFor(phase, answer)}</p>
    </section>
  </main>;
}

