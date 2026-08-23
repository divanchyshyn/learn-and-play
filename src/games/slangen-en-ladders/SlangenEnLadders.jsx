import { useMemo, useState } from 'react';

const BOARD_SIZE = 8;
const FINAL_CELL = BOARD_SIZE ** 2;
const WORDS = ['sol', 'måne', 'hus', 'bil', 'båt', 'tog', 'jeg', 'bro', 'skog', 'tre', 'blad', 'dra', 'fjell', 'snø', 'fly', 'vind', 'sky', 'elv', 'is', 'ild', 'vann', 'mat', 'brød', 'ost', 'egg', 'melk', 'kake', 'ris', 'fisk', 'eple', 'banan', 'pære', 'hund', 'katt', 'ku', 'gris', 'hest', 'sau', 'mus', 'rev', 'fugl', 'and', 'bjørn', 'løve', 'ball', 'bok', 'penn', 'stol', 'bord', 'dør', 'rom', 'seng', 'pute', 'sko', 'lue', 'vott', 'sekk', 'kart', 'flagg', 'telt', 'lek', 'mål', 'glad', 'fin'];
const ROUTES = [
  { type: 'ladder', from: 5, to: 21 },
  { type: 'ladder', from: 12, to: 28 },
  { type: 'ladder', from: 23, to: 39 },
  { type: 'ladder', from: 42, to: 58 },
  { type: 'snake', from: 18, to: 7 },
  { type: 'snake', from: 32, to: 16 },
  { type: 'snake', from: 49, to: 34 },
  { type: 'snake', from: 61, to: 44 },
];
const playerDefinitions = [{ name: 'Spiller 1', tone: 'one' }, { name: 'Spiller 2', tone: 'two' }];

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function makeWords() {
  const words = Array(FINAL_CELL + 1).fill('');
  shuffle(WORDS).forEach((word, index) => { words[index + 2] = word; });
  return words;
}

function cellToGridPosition(number) {
  const index = number - 1;
  const rowFromBottom = Math.floor(index / BOARD_SIZE);
  const columnInRow = index % BOARD_SIZE;
  return { row: BOARD_SIZE - 1 - rowFromBottom, column: rowFromBottom % 2 === 0 ? columnInRow : BOARD_SIZE - 1 - columnInRow };
}

function cellCenter(number) {
  const { row, column } = cellToGridPosition(number);
  return { x: column * 100 + 50, y: row * 100 + 50 };
}

function getCellNumber(row, column) {
  const rowFromBottom = BOARD_SIZE - 1 - row;
  return rowFromBottom % 2 === 0 ? rowFromBottom * BOARD_SIZE + column + 1 : rowFromBottom * BOARD_SIZE + BOARD_SIZE - column;
}

function Ladder({ from, to }) {
  const start = cellCenter(from);
  const end = cellCenter(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const unitX = dx / length;
  const unitY = dy / length;
  const railOffsetX = -unitY * 16;
  const railOffsetY = unitX * 16;
  const lower = { x: start.x + unitX * 20, y: start.y + unitY * 20 };
  const upper = { x: end.x - unitX * 20, y: end.y - unitY * 20 };
  return <g className="ladder-route">
    <line x1={lower.x + railOffsetX} y1={lower.y + railOffsetY} x2={upper.x + railOffsetX} y2={upper.y + railOffsetY} />
    <line x1={lower.x - railOffsetX} y1={lower.y - railOffsetY} x2={upper.x - railOffsetX} y2={upper.y - railOffsetY} />
    {[.12, .28, .44, .6, .76, .92].map((stop) => {
      const x = lower.x + (upper.x - lower.x) * stop;
      const y = lower.y + (upper.y - lower.y) * stop;
      return <line key={stop} className="ladder-rung" x1={x + railOffsetX} y1={y + railOffsetY} x2={x - railOffsetX} y2={y - railOffsetY} />;
    })}
  </g>;
}

function Snake({ from, to }) {
  const head = cellCenter(from);
  const tail = cellCenter(to);
  const controlX = (head.x + tail.x) / 2 + (head.x < tail.x ? 42 : -42);
  const controlY = (head.y + tail.y) / 2;
  const headAngle = Math.atan2(head.y - controlY, head.x - controlX) * (180 / Math.PI);
  const bodyPath = `M ${head.x} ${head.y} Q ${controlX} ${controlY} ${tail.x} ${tail.y}`;
  return <g className="snake-route">
    <path className="snake-body-outline" d={bodyPath} />
    <path className="snake-body" d={bodyPath} />
    <path className="snake-belly" d={bodyPath} />
    <g transform={`translate(${head.x} ${head.y}) rotate(${headAngle})`}>
      <ellipse className="snake-head" cx="0" cy="0" rx="16" ry="12" />
      <circle className="snake-eye" cx="5" cy="-5" r="3.2" />
      <circle className="snake-eye" cx="5" cy="5" r="3.2" />
      <circle className="snake-pupil" cx="6" cy="-5" r="1.3" />
      <circle className="snake-pupil" cx="6" cy="5" r="1.3" />
      <path className="snake-tongue" d="M 15 0 L 23 0 M 21 0 L 25 -4 M 21 0 L 25 4" />
    </g>
  </g>;
}

function BoardRoutes() {
  return <svg className="routes" viewBox="0 0 800 800" aria-hidden="true">
    <defs><filter id="route-shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".24" /></filter></defs>
    {ROUTES.map((route) => route.type === 'ladder' ? <Ladder key={`${route.type}-${route.from}`} {...route} /> : <Snake key={`${route.type}-${route.from}`} {...route} />)}
  </svg>;
}

function newGame(playerCount) {
  return { words: makeWords(), players: playerDefinitions.slice(0, playerCount).map((player) => ({ ...player, position: 1 })), currentPlayer: 0, roll: 1, pending: null, winner: null, message: 'Kast terningen for å starte spillet.' };
}

export function SlangenEnLadders() {
  const [playerCount, setPlayerCount] = useState(2);
  const [game, setGame] = useState(() => newGame(2));
  const routeByStart = useMemo(() => new Map(ROUTES.map((route) => [route.from, route])), []);
  const currentPlayer = game.players[game.currentPlayer];
  const resetGame = (count = playerCount) => setGame(newGame(count));
  const wordToRead = game.pending ? game.words[game.pending.position] : '';

  function changePlayers(event) {
    const count = Number(event.target.value);
    setPlayerCount(count);
    resetGame(count);
  }

  function rollDice() {
    if (game.pending || game.winner !== null) return;
    const roll = Math.floor(Math.random() * 6) + 1;
    const nextPosition = Math.min(FINAL_CELL, currentPlayer.position + roll);
    const players = game.players.map((player, index) => index === game.currentPlayer ? { ...player, position: nextPosition } : player);
    if (nextPosition === FINAL_CELL) {
      setGame({ ...game, players, roll, winner: game.currentPlayer, message: `${currentPlayer.name} kom til mål!` });
      return;
    }
    setGame({ ...game, players, roll, pending: { playerIndex: game.currentPlayer, position: nextPosition, route: routeByStart.get(nextPosition) }, message: `${currentPlayer.name} landet på rute ${nextPosition}. Les ordet høyt.` });
  }

  function acceptWord() {
    if (!game.pending) return;
    const { playerIndex, route } = game.pending;
    const player = game.players[playerIndex];
    const players = route ? game.players.map((item, index) => index === playerIndex ? { ...item, position: route.to } : item) : game.players;
    const landedAtGoal = route?.to === FINAL_CELL;
    const message = route ? `Riktig lest! ${player.name} ${route.type === 'ladder' ? 'klatrer opp' : 'sklir ned'} til rute ${route.to}.` : `Riktig lest! ${player.name} holder posisjonen.`;
    setGame({ ...game, players, pending: null, winner: landedAtGoal ? playerIndex : null, currentPlayer: landedAtGoal ? game.currentPlayer : (game.currentPlayer + 1) % players.length, message });
  }

  return <main className="game-page">
    <header className="game-header">
      <a className="back-link" href="../../">Spillbibliotek</a>
      <div className="title-strip"><h1>Slanger og stiger spill</h1></div>
      <p>Les ordet høyt når du lander på en rute. Klatre opp stiger og prøv å unngå slangene.</p>
      <div className="game-controls"><label>Spillere <select value={playerCount} onChange={changePlayers}><option value="1">1</option><option value="2">2</option></select></label><button className="outline-button" onClick={() => resetGame()} type="button">Nytt spill</button></div>
    </header>
    <section className="game-layout" aria-label="Slanger og stiger">
      <div className="board-frame">
        <BoardRoutes />
        <div className="board">{Array.from({ length: FINAL_CELL }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE);
          const column = index % BOARD_SIZE;
          const number = getCellNumber(row, column);
          const word = number === 1 ? 'Start' : number === FINAL_CELL ? 'Mål' : game.words[number];
          return <div className={`cell ${number === 1 ? 'start' : ''} ${number === FINAL_CELL ? 'finish' : ''}`} aria-label={`Rute ${number}: ${word}`} key={number}><span className="cell-number">{number}</span></div>;
        })}</div>
        <div className="word-labels" aria-hidden="true">{Array.from({ length: FINAL_CELL }, (_, index) => {
          const number = index + 1;
          const center = cellCenter(number);
          const word = number === 1 ? 'Start' : number === FINAL_CELL ? 'Mål' : game.words[number];
          return <span className={`word-label ${number === 1 ? 'start' : ''} ${number === FINAL_CELL ? 'finish' : ''}`} key={number} style={{ left: `${center.x / 8}%`, top: `${center.y / 8}%` }}>{word}</span>;
        })}</div>
        <div className="tokens" aria-hidden="true">{game.players.map((player, index) => {
          const center = cellCenter(player.position);
          return <span className={`token ${player.tone}`} key={player.name} style={{ left: `${center.x / 8}%`, top: `${center.y / 8}%`, '--token-offset': game.players.length > 1 ? `${index === 0 ? -12 : 12}px` : '0px' }}>{index + 1}</span>;
        })}</div>
      </div>
      <aside className="game-panel">
        <section className="status-box" aria-live="polite"><p className="panel-label">{game.winner === null ? currentPlayer.name : 'Spillet er ferdig'}</p><p className="message">{game.message}</p><div className="dice-row"><button className="roll-button" onClick={rollDice} disabled={Boolean(game.pending || game.winner !== null)} type="button">Kast terningen</button><output className="dice" aria-label={`Terningen viser ${game.roll}`}>{game.roll}</output></div></section>
        {game.pending && <section className="reading-box" aria-live="polite"><p className="panel-label">Les høyt</p><p className="reading-word">{wordToRead}</p><div className="reading-actions"><button className="roll-button" onClick={acceptWord} type="button">Riktig</button><button className="outline-button" onClick={() => setGame({ ...game, message: `${currentPlayer.name}, prøv ordet én gang til.` })} type="button">Øv mer</button></div></section>}
        <section className="players-box">{game.players.map((player, index) => <div className={`player-row ${index === game.currentPlayer && game.winner === null ? 'active' : ''}`} key={player.name}><span className={`player-dot ${player.tone}`}>{index + 1}</span><strong>{player.name}</strong><span>Rute {player.position}</span></div>)}</section>
        <section className="how-to"><h2>Slik spiller dere</h2><p>Ta annenhver tur. Kast terningen, les ordet på ruten høyt og velg Riktig når ordet er lest.</p></section>
      </aside>
    </section>
    {game.winner !== null && <div className="winner" role="dialog" aria-modal="true" aria-label="Vinner"><section><p className="panel-label">Hurra!</p><h2>{game.players[game.winner].name} vant!</h2><p>Først til mål.</p><button className="roll-button" onClick={() => resetGame()} type="button">Spill igjen</button></section></div>}
  </main>;
}
