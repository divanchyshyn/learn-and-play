import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { MAZES } from './mazes.js';
import { pickWords, speakWord } from './words.js';
import { isMuted, setMuted as setAudioMuted, sounds } from './sounds.js';

const MOVES = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

const THEME_EMOJI = { skog: '🌲', hav: '🌊', rom: '🚀' };
const THEME_BG = { skog: '#edf4e0', hav: '#e4f2f7', rom: '#eee9fa' };

const STEP_LOCK_MS = 165;
const WALL_BUMP_MS = 200;
const BOUNCE_MS = 400;
const DOOR_OPEN_MS = 280;
const CELEBRATE_DELAY_MS = 340;

function createGame(mazeIndex) {
  const maze = MAZES[mazeIndex % MAZES.length];
  // Doors are labelled in reading order (top-to-bottom, left-to-right), and
  // pickWords guarantees neighbours differ – so the two signs at every
  // junction are always clearly distinct words.
  const words = pickWords(maze.doors.length);
  const orderedDoors = [...maze.doors].sort((a, b) => a.y - b.y || a.x - b.x);
  const doors = orderedDoors.map((door, index) => ({
    ...door,
    ...words[index % words.length],
    open: false,
    tilt: index % 2 === 0 ? '-1.8deg' : '1.6deg',
  }));
  return { mazeIndex, maze, doors, pos: { ...maze.start }, phase: 'play' };
}

export function LydLabyrint() {
  const [game, setGame] = useState(() => createGame(Math.floor(Math.random() * MAZES.length)));
  const [fx, setFx] = useState(null);
  const [shakingDoor, setShakingDoor] = useState(null);
  const [soundOn, setSoundOn] = useState(!isMuted());
  const busyRef = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const genRef = useRef(0);

  const { maze, doors, pos, phase } = game;

  // A generation counter lets "Nytt labyrint" cancel any queued movement
  // steps from the previous maze so nothing leaks across games.
  const later = useCallback((gen, fn, ms) => {
    window.setTimeout(() => {
      if (genRef.current === gen) fn();
    }, ms);
  }, []);

  useEffect(() => {
    document.body.style.background = THEME_BG[maze.theme] || '';
    return () => { document.body.style.background = ''; };
  }, [maze.theme]);

  const tryMove = useCallback((direction) => {
    const current = gameRef.current;
    if (current.phase !== 'play' || busyRef.current) return;
    const gen = genRef.current;
    const [dx, dy] = MOVES[direction];
    const nx = current.pos.x + dx;
    const ny = current.pos.y + dy;
    const key = `${nx},${ny}`;
    const door = current.doors.find((d) => d.x === nx && d.y === ny);

    if (!current.maze.floors.has(key)) {
      setFx({ kind: 'bump', dx, dy });
      later(gen, () => setFx(null), WALL_BUMP_MS);
      return;
    }

    if (door && !door.open) {
      if (door.ok) {
        busyRef.current = true;
        sounds.open();
        speakWord(door.word);
        setGame((prev) => ({
          ...prev,
          doors: prev.doors.map((d) => (d.x === nx && d.y === ny ? { ...d, open: true } : d)),
        }));
        later(gen, () => {
          setGame((prev) => ({ ...prev, pos: { x: nx, y: ny } }));
          sounds.step();
          later(gen, () => {
            const bx = nx + dx;
            const by = ny + dy;
            const beyondBlocked = current.doors.some((d) => d.x === bx && d.y === by && !d.open);
            if (current.maze.floors.has(`${bx},${by}`) && !beyondBlocked) {
              setGame((prev) => ({ ...prev, pos: { x: bx, y: by } }));
            }
            later(gen, () => { busyRef.current = false; }, STEP_LOCK_MS);
          }, STEP_LOCK_MS);
        }, DOOR_OPEN_MS);
      } else {
        busyRef.current = true;
        sounds.thud();
        setShakingDoor(key);
        setFx({ kind: 'bounce', dx, dy });
        later(gen, () => {
          setFx(null);
          setShakingDoor(null);
          busyRef.current = false;
        }, BOUNCE_MS);
      }
      return;
    }

    busyRef.current = true;
    sounds.step();
    setGame((prev) => ({ ...prev, pos: { x: nx, y: ny } }));
    later(gen, () => { busyRef.current = false; }, STEP_LOCK_MS);

    if (current.maze.exit.x === nx && current.maze.exit.y === ny) {
      later(gen, () => {
        sounds.fanfare();
        setGame((prev) => ({ ...prev, phase: 'celebrate' }));
      }, CELEBRATE_DELAY_MS);
    }
  }, [later]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const direction = KEY_DIRS[event.key];
      if (!direction) return;
      event.preventDefault();
      tryMove(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tryMove]);

  function newMaze() {
    genRef.current += 1;
    busyRef.current = false;
    setFx(null);
    setShakingDoor(null);
    const nextIndex = (gameRef.current.mazeIndex + 1) % MAZES.length;
    setGame(createGame(nextIndex));
    sounds.select();
  }

  function keepExploring() {
    setGame((prev) => ({ ...prev, phase: 'play' }));
    sounds.select();
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.pop();
  }

  const lastPointerRef = useRef(0);
  const pressPad = (direction) => (event) => {
    event.preventDefault();
    lastPointerRef.current = Date.now();
    tryMove(direction);
  };
  const clickPad = (direction) => () => {
    if (Date.now() - lastPointerRef.current < 600) return;
    tryMove(direction);
  };

  const cells = [];
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const key = `${x},${y}`;
      const isFloor = maze.floors.has(key);
      const doorHere = doors.find((d) => d.x === x && d.y === y);
      const isStart = maze.start.x === x && maze.start.y === y;
      const isExit = maze.exit.x === x && maze.exit.y === y;
      let className = 'cell';
      if (!isFloor) className += ' wall';
      else {
        className += ` floor${(x + y) % 2 === 1 ? ' alt' : ''}`;
        if (isStart) className += ' start';
        if (isExit) className += ' exit';
      }
      cells.push(
        <div className={className} key={key}>
          {isExit && <span className="exit-mark" aria-hidden="true">✨</span>}
          {doorHere && <>
            <button
              type="button"
              className="word-sign"
              style={{ '--tilt': doorHere.tilt }}
              onClick={() => speakWord(doorHere.word)}
              aria-label={`Hør ordet ${doorHere.word}`}
            >
              {doorHere.word}
            </button>
            <span
              className={`door-panel${doorHere.open ? ' open' : ''}${shakingDoor === key ? ' shake' : ''}`}
              aria-hidden="true"
            >
              <span className="door-picture">{doorHere.emoji}</span>
              <span className="door-knob" />
            </span>
          </>}
        </div>,
      );
    }
  }

  return <main className={`game-page labyrinth-page theme-${maze.theme}`}>
    <GameHeader title="Lyd-labyrinten">
      <p className="labyrinth-intro">
        Hjelp reven <span aria-hidden="true">🦊</span> å finne veien ut av labyrinten.
        Gå med piltastene eller knappene under kartet. Lurer du på hva et ord sier?
        Trykk på skiltet over døren og hør det høyt.
      </p>
      <div className="game-controls">
        <span className="maze-chip">{THEME_EMOJI[maze.theme]} {maze.name}</span>
        <button className="chip" type="button" onClick={newMaze}>Nytt labyrint 🔄</button>
        <button
          className="chip toggle"
          type="button"
          aria-pressed={!soundOn}
          aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'}
          onClick={toggleSound}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </GameHeader>

    <section className="labyrinth-stage">
      <div className="board-frame">
        <div
          className="board"
          role="application"
          aria-label={`Labyrinten ${maze.name}. Gå til utgangen.`}
          style={{ '--cw': maze.width, '--ch': maze.height }}
        >
          {cells}
          <div
            className={`runner${fx ? ` fx-${fx.kind}` : ''}`}
            style={{ '--tx': pos.x, '--ty': pos.y, '--bdx': fx ? fx.dx : 0, '--bdy': fx ? fx.dy : 0 }}
            aria-hidden="true"
          >
            🦊
          </div>
        </div>

        {phase === 'celebrate' && <>
          <ConfettiLayer count={36} />
          <div className="celebrate-card" aria-live="polite">
            <p className="celebrate-mascot" aria-hidden="true">🦊</p>
            <h2>Du fant veien ut!</h2>
            <p>{maze.name} er utforsket ferdig. Vil du prøve en ny labyrint?</p>
            <div className="celebrate-actions">
              <button className="roll-button" type="button" onClick={newMaze}>Ny labyrint 🔄</button>
              <button className="outline-button" type="button" onClick={keepExploring}>Se deg rundt litt til</button>
            </div>
          </div>
        </>}
      </div>

      <div className="dpad" role="group" aria-label="Styr reven">
        <button className="pad pad-up" type="button" aria-label="Gå opp" onPointerDown={pressPad('up')} onClick={clickPad('up')}>▲</button>
        <span className="pad-center" aria-hidden="true">🐾</span>
        <button className="pad pad-left" type="button" aria-label="Gå til venstre" onPointerDown={pressPad('left')} onClick={clickPad('left')}>◀</button>
        <button className="pad pad-right" type="button" aria-label="Gå til høyre" onPointerDown={pressPad('right')} onClick={clickPad('right')}>▶</button>
        <button className="pad pad-down" type="button" aria-label="Gå ned" onPointerDown={pressPad('down')} onClick={clickPad('down')}>▼</button>
      </div>
    </section>
  </main>;
}
