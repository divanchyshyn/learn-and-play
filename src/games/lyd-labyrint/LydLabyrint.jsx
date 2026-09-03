import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { THEMES, generateMaze } from './mazes.js';
import { pickWords, speakWord } from './words.js';
import { SpellPuzzle } from './SpellPuzzle.jsx';
import {
  PiecePuzzle,
  PUZZLE_PIECE_COUNT,
  createPuzzleSession,
  earnPiece,
  placePiece,
  recallPiece,
} from './PiecePuzzle.jsx';
import { isMuted, setMuted as setAudioMuted, sounds } from './sounds.js';
import { shuffle } from '../../shared/random.js';
import puzzleCarrier from './puzzle-assets/carrier.webp';
import puzzleSubmarine from './puzzle-assets/submarine-yard.webp';
import puzzleChinook from './puzzle-assets/chinook.webp';
import puzzleSr71 from './puzzle-assets/sr71.webp';
import puzzleTomcat from './puzzle-assets/tomcat.webp';

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

const THEME_EMOJI = { skog: '\u{1F332}', hav: '\u{1F30A}', savanne: '\u{1F33E}' };
const THEME_BG = { skog: '#edf4e0', hav: '#e4f2f7', savanne: '#fcf5df' };
// The explorer's mascot changes with the habitat: forest → fox, ocean → sea
// turtle, savannah → leopard.
const THEME_RUNNER = { skog: '\u{1F98A}', hav: '\u{1F422}', savanne: '\u{1F406}' };

const STEP_LOCK_MS = 165;
const WALL_BUMP_MS = 200;
const CELEBRATE_DELAY_MS = 340;
// How long the earned puzzle piece stays on the celebrate card before it
// "disappears" and the card's normal actions (and the button highlight) take over.
const PIECE_REVEAL_MS = 1800;

// The picture rotates between five prepared puzzle images (one per full run).
// The images are square crops of the originals the feature shipped with; the
// four pieces are just the four quadrants, sliced in CSS at render time.
const PUZZLE_IMAGES = [puzzleCarrier, puzzleSubmarine, puzzleChinook, puzzleSr71, puzzleTomcat];

// A fresh maze is carved for every game: bigger than the old hand-drawn maps,
// with real branches and dead ends to explore - but exactly one way out.
// Every door is a spelling lock whose animal belongs to the maze's habitat
// (forest, ocean, savannah); the words are shuffled again so no two games
// stack the same word on the same door.
// The runner mascot is picked per habitat too.
function createGame(mazeIndex) {
  const def = THEMES[mazeIndex % THEMES.length];
  const maze = generateMaze(def);
  const words = shuffle(pickWords(maze.doors.length, def.theme));
  const doors = maze.doors.map((door, index) => ({
    ...door,
    ...words[index % words.length],
    open: false,
    tilt: index % 2 === 0 ? '-1.8deg' : '1.6deg',
  }));
  return {
    maze, mazeIndex, doors,
    runner: THEME_RUNNER[def.theme],
    pos: { ...maze.start },
    phase: 'play',
    puzzle: null,
    celebrated: false,
    pieceJustEarned: -1,
  };
}

export function LydLabyrint() {
  const [game, setGame] = useState(() => createGame(Math.floor(Math.random() * THEMES.length)));
  const [fx, setFx] = useState(null);
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [pieceSession, setPieceSession] = useState(() => createPuzzleSession(PUZZLE_IMAGES.length));
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [pieceReveal, setPieceReveal] = useState(false);
  const busyRef = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const pieceSessionRef = useRef(pieceSession);
  pieceSessionRef.current = pieceSession;
  const genRef = useRef(0);

  const { maze, doors, pos, phase, puzzle, runner, pieceJustEarned } = game;

  // The generation counter lets "Nytt labyrint" cancel any queued movement
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

  // Reaching the exit earns one puzzle piece and opens the celebrate card. The
  // piece pops up on the card for a moment, then "disappears" while the
  // Puslespill button starts to glow; earning the fourth piece auto-opens the
  // assembler right after the reveal so the child can build their picture.
  const celebrateMaze = useCallback((gen) => {
    sounds.fanfare();
    const session = pieceSessionRef.current;
    const next = earnPiece(session);
    const earnedNew = next.earned.length > session.earned.length;
    // Pieces are rewarded in a fixed order, so the newest one is the last earned.
    const pieceIndex = earnedNew ? next.earned[next.earned.length - 1] : -1;
    setPieceSession(next);
    setGame((prev) => ({ ...prev, phase: 'celebrate', celebrated: true, pieceJustEarned: pieceIndex }));
    if (pieceIndex >= 0) {
      sounds.pieceEarned();
      setPieceReveal(true);
      // The fourth earned piece hands over the full set, so the assembler
      // opens by itself once the reveal has faded.
      const allEarned = next.earned.length === PUZZLE_PIECE_COUNT;
      later(gen, () => {
        setPieceReveal(false);
        if (allEarned) setPuzzleOpen(true);
      }, PIECE_REVEAL_MS);
    }
  }, [later]);

  // Set the fox down on a floor cell; reaching the exit starts the celebration.
  const arrive = useCallback((gen, x, y) => {
    setGame((prev) => ({ ...prev, pos: { x, y } }));
    sounds.step();
    if (gameRef.current.maze.exit.x === x
      && gameRef.current.maze.exit.y === y
      && !gameRef.current.celebrated) {
      later(gen, () => celebrateMaze(gen), CELEBRATE_DELAY_MS);
    }
  }, [later, celebrateMaze]);

  const tryMove = useCallback((direction) => {
    const current = gameRef.current;
    // The puzzle popup is open, so the maze is paused: keys must not move the
    // runner invisibly behind the panel.
    if (current.phase !== 'play' || busyRef.current || puzzleOpen) return;
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
      // Walking into a closed door opens its spelling lock.
      sounds.thud();
      setGame((prev) => ({ ...prev, phase: 'puzzle', puzzle: { key, dx, dy } }));
      return;
    }

    busyRef.current = true;
    arrive(gen, nx, ny);
    later(gen, () => { busyRef.current = false; }, STEP_LOCK_MS);
  }, [arrive, later, puzzleOpen]);

  // The spelling lock is solved: say the word, unlock the door and step onto
  // the door tile itself – the runner stops there instead of leaping past it.
  const handleSolve = useCallback(() => {
    const current = gameRef.current;
    const target = current.puzzle;
    if (!target) return;
    const door = current.doors.find((d) => `${d.x},${d.y}` === target.key);
    if (!door) return;
    const gen = genRef.current;
    busyRef.current = true;
    sounds.open();
    speakWord(door.word);
    setGame((prev) => ({
      ...prev,
      doors: prev.doors.map((d) => (d.x === door.x && d.y === door.y ? { ...d, open: true } : d)),
      phase: 'play',
      puzzle: null,
    }));
    later(gen, () => {
      arrive(gen, door.x, door.y);
      later(gen, () => { busyRef.current = false; }, STEP_LOCK_MS);
    }, 140);
  }, [arrive, later]);

  // Step away from a spelling lock without solving it – explore elsewhere,
  // the door stays closed and can be tried again any time.
  const closePuzzle = useCallback(() => {
    setGame((prev) => (prev.puzzle ? { ...prev, phase: 'play', puzzle: null } : prev));
    sounds.select();
  }, []);

  // ---- Puzzle-piece collection panel -------------------------------
  const openPuzzleScreen = useCallback(() => {
    if (gameRef.current.phase !== 'play') return;
    sounds.select();
    setPuzzleOpen(true);
  }, []);

  const closePuzzleScreen = useCallback(() => {
    setPuzzleOpen(false);
    sounds.select();
  }, []);

  const handlePlacePiece = useCallback((piece) => {
    const next = placePiece(pieceSessionRef.current, piece);
    if (next !== pieceSessionRef.current) {
      setPieceSession(next);
      sounds.piecePlaced();
    }
  }, []);

  const handleRecallPiece = useCallback((piece) => {
    const next = recallPiece(pieceSessionRef.current, piece);
    if (next !== pieceSessionRef.current) {
      setPieceSession(next);
      sounds.select();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      // Escape closes whichever panel is on top: the puzzle popup first, then
      // a spelling lock.
      if (event.key === 'Escape' && puzzleOpen) {
        closePuzzleScreen();
        return;
      }
      const direction = KEY_DIRS[event.key];
      if (direction) {
        if (puzzleOpen) return;
        event.preventDefault();
        tryMove(direction);
        return;
      }
      if (event.key === 'Escape' && gameRef.current.phase === 'puzzle') closePuzzle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tryMove, closePuzzle, puzzleOpen, closePuzzleScreen]);

  // Every fresh maze keeps the collected pieces: the child solves one maze,
  // earns its piece, and picks the next labyrinth to start hunting the next.
  function startFreshMaze() {
    genRef.current += 1;
    busyRef.current = false;
    setFx(null);
    const nextIndex = (gameRef.current.mazeIndex + 1) % THEMES.length;
    setGame(createGame(nextIndex));
  }

  function newMaze() {
    setPieceReveal(false);
    startFreshMaze();
    sounds.select();
  }

  function keepExploring() {
    setGame((prev) => ({ ...prev, phase: 'play' }));
    sounds.select();
  }

  // "Spill igjen" on the finished picture: collect a brand-new picture (the
  // next rotating image) from a fresh maze.
  const handleRestart = () => {
    setPieceSession(createPuzzleSession(PUZZLE_IMAGES.length));
    setPieceReveal(false);
    setPuzzleOpen(false);
    startFreshMaze();
    sounds.select();
  };

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

  const puzzleDoor = puzzle
    ? doors.find((d) => `${d.x},${d.y}` === puzzle.key) || null
    : null;

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
          {isExit && <span className="exit-mark" aria-hidden="true">{'\u2728'}</span>}
          {doorHere && (
            <button
              type="button"
              className={`door-panel${doorHere.open ? ' open' : ''}`}
              style={{ '--tilt': doorHere.tilt }}
              onClick={() => speakWord(doorHere.word)}
              aria-label={`Hør ordet ${doorHere.word}`}
            >
              <span className="door-picture">{doorHere.emoji}</span>
              <span className="door-knob" aria-hidden="true" />
            </button>
          )}
        </div>,
      );
    }
  }

  return <main className={`game-page labyrinth-page theme-${maze.theme}`}>
    <GameHeader title="Lyd-labyrinten">
      <button
        type="button"
        key={`${pieceSession.earned.length}-${pieceSession.imageIndex}`}
        className={`chip puzzle-chip${pieceSession.earned.length > 0 ? ' has-pieces' : ''}${puzzleOpen ? ' active' : ''}`}
        onClick={openPuzzleScreen}
        disabled={phase !== 'play' || puzzleOpen}
        aria-label={`Puslespill – ${pieceSession.earned.length} av 4 brikker funnet`}
      >
        {'\u{1F9E9}'} Puslespill
        <span className="puzzle-count" aria-hidden="true">{pieceSession.earned.length}/4</span>
      </button>
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
            {runner}
          </div>
        </div>

        {phase === 'celebrate' && <>
          <ConfettiLayer count={36} />
          <div
            className="celebrate-card"
            role="dialog"
            aria-modal="true"
            aria-label="Gratulerer"
            aria-live="polite"
          >
            <p className="celebrate-mascot" aria-hidden="true">{runner}</p>
            <h2>Du fant veien ut!</h2>
            {pieceReveal && pieceJustEarned >= 0 ? (
              <>
                <p>Du fant en puslespillbrikke!</p>
                <div
                  className="piece-reveal"
                  style={{ '--puzzle-image': `url(${PUZZLE_IMAGES[pieceSession.imageIndex]})` }}
                  aria-hidden="true"
                >
                  <span className={`puzzle-piece piece-${pieceJustEarned}`} />
                </div>
                <p className="piece-reveal-hint">Trykk på Puslespill-knappen for å se brikkene dine.</p>
              </>
            ) : (
              <>
                {pieceJustEarned === -1
                  ? <p>Du har funnet alle brikkene – åpne Puslespill for å bygge bildet!</p>
                  : <p>{maze.name} er utforsket ferdig. Vil du prøve en ny labyrint?</p>}
                <div className="celebrate-actions">
                  <button className="roll-button" type="button" onClick={newMaze}>Ny labyrint {'\u{1F504}'}</button>
                  <button className="outline-button" type="button" onClick={keepExploring}>Se deg rundt litt til</button>
                </div>
              </>
            )}
          </div>
        </>}
      </div>

      {puzzleDoor && (
        <SpellPuzzle
          word={puzzleDoor.word}
          emoji={puzzleDoor.emoji}
          onSolve={handleSolve}
          onClose={closePuzzle}
        />
      )}

      {puzzleOpen && (
        <PiecePuzzle
          images={PUZZLE_IMAGES}
          session={pieceSession}
          onClose={closePuzzleScreen}
          onPlace={handlePlacePiece}
          onRecall={handleRecallPiece}
          onRestart={handleRestart}
        />
      )}

      <div className="game-controls">
        <span className="maze-chip">{THEME_EMOJI[maze.theme]} {maze.name}</span>
        <button className="chip" type="button" onClick={newMaze}>Nytt labyrint {'\u{1F504}'}</button>
        <button
          className="chip toggle"
          type="button"
          aria-pressed={!soundOn}
          aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'}
          onClick={toggleSound}
        >
          {soundOn ? '\u{1F50A}' : '\u{1F507}'}
        </button>
      </div>

      <div className="dpad" role="group" aria-label={`Styr ${runner}`}>
        <button className="pad pad-up" type="button" aria-label="Gå opp" onPointerDown={pressPad('up')} onClick={clickPad('up')}>▲</button>
        <span className="pad-center" aria-hidden="true">{'\u{1F43E}'}</span>
        <button className="pad pad-left" type="button" aria-label="Gå til venstre" onPointerDown={pressPad('left')} onClick={clickPad('left')}>◀</button>
        <button className="pad pad-right" type="button" aria-label="Gå til høyre" onPointerDown={pressPad('right')} onClick={clickPad('right')}>▶</button>
        <button className="pad pad-down" type="button" aria-label="Gå ned" onPointerDown={pressPad('down')} onClick={clickPad('down')}>▼</button>
      </div>
    </section>
  </main>;
}