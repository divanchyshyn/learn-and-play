import { ReefArt } from './ReefArt.jsx';
import { allWordsCaught, crateTally, hasWord, wordsCaught, wordsLeftToCatch } from './journal.js';
import { REEF_REWARDS } from './trip.js';
import { ALL_CRATES, WORD_COUNT, wordsInCrate } from './words.js';

// How many trip stamps fit on the page before we simply count the rest.
const MAX_STAMPS = 12;

// The fishing book: every word the child has caught, the trips they have
// finished, and the reef they have grown. Locked words show as "?" – a calm
// picture of what is left to find rather than a punishment for what is missing.
export function Fangstbok({ journal, onClose }) {
  const crates = ALL_CRATES.filter((crate) => crate.kind === 'category');
  const complete = allWordsCaught(journal);
  const found = new Set(journal.decorations);

  return <div className="book-overlay">
    <article className="book" role="dialog" aria-modal="true" aria-label="Fangstboka">
      <header className="book-head">
        <h2>Fangstboka</h2>
        <p className="book-tally">{wordsCaught(journal)} av {WORD_COUNT} ord fanget</p>
        <button className="chip book-close" type="button" onClick={onClose} aria-label="Lukk fangstboka">
          Lukk <span aria-hidden="true">✖️</span>
        </button>
      </header>

      <p className={complete ? 'book-finale' : 'book-next'}>
        {complete
          ? <><span aria-hidden="true">🎉</span> Alle ordene er fanget!</>
          : `${wordsLeftToCatch(journal)} ord igjen å finne.`}
      </p>

      <section className="book-pages" aria-label="Ordene i boka">
        {crates.map((crate) => {
          const { caught, total } = crateTally(journal, crate.id);
          return <div className="book-page" key={crate.id}>
            <h3>
              <span aria-hidden="true">{crate.icon}</span> {crate.label}
              <span className="book-page-count">{caught} av {total}</span>
            </h3>
            <ul className="word-slots">
              {wordsInCrate(crate.id).map((entry) => {
                const isFound = hasWord(journal, entry.word);
                return <li className={isFound ? 'found' : 'missing'} key={entry.word}>
                  {isFound ? entry.word : <span aria-hidden="true">?</span>}
                  {!isFound && <span className="visually-hidden">ikke fanget ennå</span>}
                </li>;
              })}
            </ul>
          </div>;
        })}
      </section>

      <section className="book-stamps" aria-label="Turene du har fullført">
        <h3>Stempler <span className="book-page-count">{journal.trips} {journal.trips === 1 ? 'tur' : 'turer'}</span></h3>
        {journal.trips === 0
          ? <p className="book-empty">Ingen turer ferdige ennå – fyll en kasse og kom tilbake.</p>
          : <ul className="stamp-row">
            {Array.from({ length: Math.min(journal.trips, MAX_STAMPS) }, (_, index) => (
              <li key={index}>Tur {index + 1}</li>
            ))}
            {journal.trips > MAX_STAMPS && <li className="stamp-more">+{journal.trips - MAX_STAMPS}</li>}
          </ul>}
      </section>

      <section className="book-reef" aria-label="Sjøbunnen din">
        <h3>Sjobunnen <span className="book-page-count">{found.size} av {REEF_REWARDS.length}</span></h3>
        <ul className="reef-row">
          {REEF_REWARDS.map((reward, index) => {
            const isFound = found.has(index);
            return <li className={isFound ? 'found' : 'missing'} key={reward.id}>
              <span className="reef-preview" aria-hidden="true"><ReefArt id={reward.id} /></span>
              <span className="reef-name">{isFound ? reward.label : '?'}</span>
              {!isFound && <span className="visually-hidden">ikke funnet ennå</span>}
            </li>;
          })}
        </ul>
      </section>
    </article>
  </div>;
}
