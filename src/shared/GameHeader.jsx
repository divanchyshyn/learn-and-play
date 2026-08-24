import './game-header.css';

// The shared top of every game page: one consistent way back to the library
// plus the game title. Per-game theming (title-strip colour, intro text,
// control chips) stays in each game's own markup and stylesheet via children.
export function GameHeader({ title, children }) {
  return <header className="game-header">
    <a className="back-link" href="../../">Spillbibliotek</a>
    <div className="title-strip"><h1>{title}</h1></div>
    {children}
  </header>;
}
