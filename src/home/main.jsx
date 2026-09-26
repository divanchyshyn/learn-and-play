import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './style.css';

// One entry per published game. Unfinished games stay commented out (and
// marked "(hidden)" in README.md) but keep building, so their direct URLs
// under ./games/<slug>/ keep working.
const GAMES = [
  { title: 'Lyd-labyrinten', description: 'Utforsk en stor labyrint, hør dyrene og stav ordene riktig for å åpne dørene.', href: './games/sound-labyrinth/', badge: 'Lesespill', art: 'maze' },
  { title: 'Slanger og stiger', description: 'Les norske ord, klatre opp stiger og pass på slangene.', href: './games/snakes-and-ladders/', badge: 'Ordspill', art: 'snake' },
  // Card battle is hidden from the library while the game is still in development – it keeps building and is reachable at ./games/card-battle/
  // { title: 'Kortkrig', description: 'Løs Rex sine tallgåter, velg det rette kortet og samle 16 dyrekort.', href: './games/card-battle/', badge: 'Regnespill', art: 'cards' },
  { title: 'Ordfiske', description: 'Fisk ord med fiskebåten, sveiv dem inn og legg dem i rett kasse. Fyll fangstboka og pynt sjøbunnen.', href: './games/word-fishing/', badge: 'Lesespill', art: 'fishing' },
  { title: 'Butikken', description: 'Handle i butikken: kjøp varer, trekk prisen fra lommeboka di og skriv svaret selv – eller lever tilbake det du angrer på.', href: './games/shop/', badge: 'Regnespill', art: 'shop' },
];

// Decorative tile artwork, one small drawing per game. A new game either
// reuses an existing drawing or adds a key here – no ternary chains.
const TILE_ART = {
  snake: () => <><span className="tile-ladder" /><span className="tile-snake" /></>,
  maze: () => <><span className="tile-hedge hedge-a" /><span className="tile-hedge hedge-b" /><span className="tile-doorway">🚪</span><span className="tile-fox">🦊</span></>,
  cards: () => <><span className="tile-card card-a">7</span><span className="tile-card card-b">12</span><span className="tile-boom">💥</span></>,
  shop: () => <><span className="tile-awning" /><span className="tile-cart">🛒</span><span className="tile-tag">tilbud!</span></>,
  fishing: () => <><span className="tile-sun" /><span className="tile-wave" /><span className="tile-boat">⛵</span><span className="tile-trout">🐠</span><span className="tile-hook">🎣</span></>,
  jump: () => <><span className="tile-ground" /><span className="tile-arc" /><span className="tile-hopper">🐸</span></>,
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