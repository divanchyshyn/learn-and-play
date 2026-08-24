import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './style.css';

// One entry per published game. Unfinished games stay commented out (and
// marked "(hidden)" in README.md) but keep building, so their direct URLs
// under ./games/<slug>/ keep working.
const GAMES = [
  // Lyd-labyrinten er skjult fra biblioteket mens spillet videreutvikles – den bygges fortsatt og nås via ./games/lyd-labyrint/
  // { title: 'Lyd-labyrinten', description: 'Gå gjennom labyrinten og velg dører med ord – hvilken vei går reven?', href: './games/lyd-labyrint/', badge: 'Lesespill', art: 'maze' },
    { title: 'Slanger og stiger', description: 'Les norske ord, klatre opp stiger og pass på slangene.', href: './games/slangen-en-ladders/', badge: 'Ordspill', art: 'snake' },
  // Kortkrig er skjult fra biblioteket mens spillet videreutvikles – det bygges fortsatt og nås via ./games/kortkrig/
  // { title: 'Kortkrig', description: 'Kortduell mot Rex – snu kortene, sammenlign tall og se hvem som slår hardest.', href: './games/kortkrig/', badge: 'Regnespill', art: 'cards' },
  // Ordfiske er skjult fra biblioteket mens spillet videreutvikles – det bygges fortsatt og nås via ./games/ordfiske/
  // { title: 'Ordfiske', description: 'Fisk ord-fisker opp av vatnet i roligt tempo og fyll bøtta di – helt i eget tempo.', href: './games/ordfiske/', badge: 'Lesespill', art: 'fishing' },
  // Butikken er skjult fra biblioteket mens spillet videreutvikles – den bygges fortsatt og nås via ./games/butikken/
  // { title: 'Butikken', description: 'Kjøp varer, betal i kassen og regn ut vekslepengene du får tilbake.', href: './games/butikken/', badge: 'Regnespill', art: 'shop' },
];

// Decorative tile artwork, one small drawing per game. A new game either
// reuses an existing drawing or adds a key here – no ternary chains.
const TILE_ART = {
  snake: () => <><span className="tile-ladder" /><span className="tile-snake" /></>,
  maze: () => <><span className="tile-hedge hedge-a" /><span className="tile-hedge hedge-b" /><span className="tile-doorway">🚪</span><span className="tile-fox">🦊</span></>,
  cards: () => <><span className="tile-card card-a">7</span><span className="tile-card card-b">12</span><span className="tile-boom">💥</span></>,
  shop: () => <><span className="tile-awning" /><span className="tile-cart">🛒</span><span className="tile-tag">tilbud!</span></>,
  fishing: () => <><span className="tile-wave" /><span className="tile-trout">🐟</span><span className="tile-hook">🎣</span></>,
};

function TileArt({ art }) {
  const Artwork = TILE_ART[art] ?? TILE_ART.snake;
  return (
    <div className={`tile-art${art ? ` tile-art-${art}` : ''}`} aria-hidden="true">
      <Artwork />
        </div>
  );
}

function Home() {
  return (
    <main className="library-shell">
      <header className="library-header">
        <p className="library-kicker">Lek og lær</p>
        <h1>Spillbibliotek</h1>
        <p>Velg et spill og sett i gang.</p>
      </header>
      <section className="game-library" aria-label="Tilgjengelige spill">
        {GAMES.map((game) => (
          <a className="game-tile" href={game.href} key={game.href}>
            <TileArt art={game.art} />
            <div className="tile-body">
              <span>{game.badge}</span>
              <h2>{game.title}</h2>
              <p>{game.description}</p>
              <strong>Åpne spillet <span aria-hidden="true">→</span></strong>
            </div>
          </a>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Home />);



