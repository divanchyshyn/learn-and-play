import './game-header.css';

// The shared top of every game page: a compact bar with the way back to the
// library and the game title as a small coloured pill right next to it.
// Per-game theming (title-pill colour, intro text, control chips) stays in
// each game's own markup and stylesheet via children.
export function GameHeader({ title, children }) {
  return (
    <header className="game-header">
      <div className="header-bar">
        <a className="back-link" href="../../">Spillbibliotek</a>
        <span className="header-sep" aria-hidden="true">&rarr;</span>
        <div className="title-strip"><h1>{title}</h1></div>
      </div>
      {children}
    </header>
  );
}
