import { useEffect, useRef } from 'react';
import { ReefArt } from './ReefRewards.jsx';
import { allWordsCaught, caughtWordsInCrate, crateTally, wordsCaught, wordsLeftToCatch } from './journal.js';
import { REEF_REWARDS } from './trip.js';
import { ALL_CRATES, TARGET_WORD_COUNT } from './words.js';

// How many trip stamps fit on the page before we simply count the rest.
const MAX_STAMPS = 12;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// The fishing book: every word the child has caught, the trips they have
// finished, and the reef they have grown. A crate page shows the caught words
// of its pool first and a "?" for every word still missing from the crate's
// ten-word target, so the page is always the crate's real goal – never the size
// of the pool behind it.
//
// It declares itself a modal dialog, so it has to behave like one: the focus
// moves into the book when it opens, Tab stays inside until it closes, and the
// button that opened it gets the focus back afterwards.
export function FishingBook({ journal, onClose }) {
  const complete = allWordsCaught(journal);
  const found = new Set(journal.decorations);
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    // Whatever had the focus (the "Fangstboka" chip) is what gets it back.
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const stops = [...panel.querySelectorAll(FOCUSABLE)];
      if (stops.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return <div className="book-overlay">
    <article
      className="book"
      role="dialog"
      aria-modal="true"
      aria-label="Fangstboka"
      ref={panelRef}
      tabIndex={-1}
    >
      <header className="book-head">
        <h2>Fangstboka</h2>
        <p className="book-tally">{wordsCaught(journal)} av {TARGET_WORD_COUNT} ord fanget</p>
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
        {ALL_CRATES.map((crate) => {
          const { caught, total } = crateTally(journal, crate.id);
          const foundWords = caughtWordsInCrate(journal, crate.id);
          return <div className="book-page" key={crate.id}>
            <h3>
              <span aria-hidden="true">{crate.icon}</span> {crate.label}
              <span className="book-page-count">{caught} av {total}</span>
            </h3>
            <ul className="word-slots">
              {foundWords.map((word) => <li className="found" key={word}>{word}</li>)}
              {Array.from({ length: Math.max(0, total - caught) }, (_, index) => (
                <li className="missing" key={`missing-${index}`}>
                  <span aria-hidden="true">?</span>
                  <span className="visually-hidden">ikke fanget ennå</span>
                </li>
              ))}
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
        <h3>Sjøbunnen <span className="book-page-count">{found.size} av {REEF_REWARDS.length}</span></h3>
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
