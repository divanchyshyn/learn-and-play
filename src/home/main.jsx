import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './style.css';

const games = [
  { title: 'Slanger og stiger', description: 'Les norske ord, klatre opp stiger og pass på slangene.', href: './games/slangen-en-ladders/', badge: 'Ordspill', art: 'snake' },
  // Butikken er skjult fra biblioteket mens spillet videreutvikles – den bygges fortsatt og nås via ./games/butikken/
  // { title: 'Butikken', description: 'Kjøp varer, betal i kassen og regn ut vekslepengene du får tilbake.', href: './games/butikken/', badge: 'Regnespill', art: 'shop' },
];

function Home() {
  return <main className="library-shell">
    <header className="library-header"><p className="library-kicker">Lek og lær</p><h1>Spillbibliotek</h1><p>Velg et spill og sett i gang.</p></header>
    <section className="game-library" aria-label="Tilgjengelige spill">
      {games.map((game) => <a className="game-tile" href={game.href} key={game.href}>
        <div className="tile-art" aria-hidden="true">
          {game.art === 'shop'
            ? <><span className="tile-awning" /><span className="tile-cart">🛒</span><span className="tile-tag">tilbud!</span></>
            : <><span className="tile-ladder" /><span className="tile-snake" /></>}
        </div>
        <div className="tile-body"><span>{game.badge}</span><h2>{game.title}</h2><p>{game.description}</p><strong>Åpne spillet <span aria-hidden="true">→</span></strong></div>
      </a>)}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<Home />);
