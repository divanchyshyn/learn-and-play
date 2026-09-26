import { useState } from 'react';
import { pickOne } from '../../shared/random.js';
import { speakNorwegian } from '../../shared/speech.js';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { usePersistentState } from '../../shared/usePersistentState.js';
import {
  CREATURES, PAGES, attempt, creaturesInPage, equationText, makeRiddle,
  pageById, riddleLabel, spokenEquation, tierForDiscovered,
} from './riddles.js';
import {
  ALBUM_KEY, albumCodec, albumComplete, createAlbum, discoverCreature,
  foundCount, nextCreature, pageTally,
} from './album.js';
import { setMuted as setAudioMuted, sounds } from './sounds.js';

// Read-aloud stays part of this game's public surface for tests/tools.
export { speakNorwegian };

// Rex is a good sport: every line is warm, and a wrong card is only ever an
// invitation to look again.
export const REX_LINES = {
  ready: [
    'Rex legger gåten på bordet …',
    'Rex utfordrer deg: hvilket kort mangler?',
    'Rex tripper spent – klarer du kortgåten?',
  ],
  nudge: [
    'Ikke helt! Se på regnestykket og prøv et annet kort.',
    'Nesten! Rex tror du finner det riktige kortet nå.',
    'Hmm, prøv et annet kort – du er på sporet!',
  ],
  cheer: [
    'Rex hopper av glede! 🎉',
    'Rex roper: Så flink du er!',
    'Rex danser gledesdans!',
  ],
};

function HandCard({ value, selected, used, onSelect }) {
  const classes = ['hand-card'];
  if (selected) classes.push('selected');
  if (used) classes.push('used');
  return <button
    className={classes.join(' ')}
    type="button"
    aria-label={`Velg kortet ${value}`}
    aria-pressed={selected}
    disabled={used}
    onClick={() => onSelect(value)}
  >{value}</button>;
}

function AlbumCard({ creature, found }) {
  return <div className={`album-card${found ? ' found' : ''}`} data-creature={creature.id}>
    <span className="album-emoji" aria-hidden="true">{found ? creature.emoji : '❓'}</span>
    <span className="album-name">{found ? creature.name : '???'}</span>
  </div>;
}

// One card from Rex, one missing card from the hand, one animal revealed behind
// every solved riddle. The whole game is that loop, repeated across four pages
// that grow from sums under ten to mixed plus and minus.
export function CardBattle() {
  const [album, setAlbum] = usePersistentState(ALBUM_KEY, createAlbum, albumCodec);
  const [riddle, setRiddle] = useState(() => makeRiddle(tierForDiscovered(foundCount(album))));
  const [selected, setSelected] = useState(null);
  const [used, setUsed] = useState([]);
  const [mistake, setMistake] = useState(null);
  const [solved, setSolved] = useState(null);
  const [rexLine, setRexLine] = useState(() => pickOne(REX_LINES.ready));
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);

  const found = foundCount(album);
  const complete = albumComplete(album);

  function dealRiddle(count) {
    setRiddle(makeRiddle(tierForDiscovered(count)));
    setSelected(null);
    setUsed([]);
    setMistake(null);
    setSolved(null);
    setRexLine(pickOne(REX_LINES.ready));
  }

  function selectCard(value) {
    if (solved || used.includes(value)) return;
    setSelected(value);
    setMistake(null);
    sounds.select();
  }

  function layCard() {
    if (selected === null || solved) return;
    const outcome = attempt(riddle, selected);
    if (!outcome.correct) {
      setUsed((cards) => [...cards, selected]);
      setMistake(equationText(riddle.operation, selected, riddle.rexValue, outcome.result));
      setSelected(null);
      setRexLine(pickOne(REX_LINES.nudge));
      sounds.wrong();
      return;
    }

    const firstTry = used.length === 0;
    const completeBefore = complete;
    const creature = nextCreature(album) ?? pickOne(CREATURES);
    const grown = discoverCreature(album, creature.id);
    setAlbum(grown);
    const tally = pageTally(grown, creature.page);
    setSolved({
      creature,
      equation: equationText(riddle.operation, selected, riddle.rexValue, riddle.target),
      firstTry,
      page: pageById(creature.page),
      // A complete album before this solve means every page already wears its
      // medal – celebrating the last card alone is the finale's job.
      pageDone: !completeBefore && tally.total > 0 && tally.found >= tally.total,
    });
    setRexLine(pickOne(REX_LINES.cheer));
    if (firstTry) sounds.medal();
    else sounds.correct();
    if (voiceOn) speakNorwegian(spokenEquation(riddle.operation, selected, riddle.rexValue));
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.select();
  }

  function toggleVoice() {
    setVoiceOn((on) => !on);
    sounds.select();
  }

  function startOver() {
    const fresh = createAlbum();
    setAlbum(fresh);
    dealRiddle(0);
    sounds.medal();
  }

  return <main className="game-page battle-page">
    <GameHeader title="Kortkrigen">
      <p>Rex gjemmer et dyrekort bak hver kortgåte. Velg kortet som mangler i regnestykket – og se hvilket dyr som dukker opp!</p>
      <div className="game-controls">
        <span className="found-chip">🃏 {found} av {CREATURES.length} kort funnet</span>
        <button className="chip toggle" type="button" aria-pressed={voiceOn} aria-label={voiceOn ? 'Slå av opplesning' : 'Les regnestykket høyt'} onClick={toggleVoice}>{voiceOn ? '🗣 Lesing: på' : '🗣 Lesing: av'}</button>
        <button className="chip toggle" type="button" aria-pressed={!soundOn} aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'} onClick={toggleSound}>{soundOn ? '🔊' : '🔇'}</button>
      </div>
    </GameHeader>

    <section className="arena" aria-label="Kortkrigen-arenaen">
      <div className="rex-row">
        <span className="rex-avatar" aria-hidden="true">🦖</span>
        <p className="rex-line" aria-live="polite">{rexLine}</p>
      </div>

      <div
        className="riddle-card"
        data-operation={riddle.operation}
        data-rex={riddle.rexValue}
        data-target={riddle.target}
        role="img"
        aria-label={riddleLabel(riddle)}
      >
        {riddle.operation === 'plus' ? <>
          <span className="riddle-term">{riddle.rexValue}</span>
          <span className="riddle-op" aria-hidden="true">+</span>
          <span className="riddle-blank">{selected ?? '?'}</span>
        </> : <>
          <span className="riddle-blank">{selected ?? '?'}</span>
          <span className="riddle-op" aria-hidden="true">−</span>
          <span className="riddle-term">{riddle.rexValue}</span>
        </>}
        <span className="riddle-op" aria-hidden="true">=</span>
        <span className="riddle-term riddle-target">{riddle.target}</span>
      </div>
      <p className="riddle-hint">Hvilket kort passer i ruten?</p>

      {!solved && <>
        <div className="hand" role="group" aria-label="Hånden din">
          {riddle.hand.map((value) => <HandCard
            key={value}
            value={value}
            selected={selected === value}
            used={used.includes(value)}
            onSelect={selectCard}
          />)}
        </div>

        {mistake && <p className="mistake" aria-live="polite">{mistake} passer ikke. Prøv et annet kort!</p>}

        <button className="lay-button" type="button" disabled={selected === null} onClick={layCard}>Legg kortet!</button>
      </>}
    </section>

    {solved && <section className="reveal" aria-live="polite">
      <div className="creature-card">
        <span className="creature-emoji" aria-hidden="true">{solved.creature.emoji}</span>
        <h2 className="creature-name">{solved.creature.name}</h2>
        <p className="creature-fact">{solved.creature.fact}</p>
        <p className="solved-equation">{solved.equation}</p>
      </div>
      {solved.firstTry && <p className="bonus">⭐ Feilfritt! Rex er imponert.</p>}
      {solved.pageDone && solved.page && <p className="page-medal" data-page={solved.page.id}>{solved.page.emoji} {solved.page.label} er samlet!</p>}
      <button className="next-button" type="button" onClick={() => dealRiddle(foundCount(album))}>Neste gåte</button>
      {solved.pageDone && <ConfettiLayer />}
    </section>}

    <section className="album" aria-label="Dyrealbumet">
      <h2 className="album-title">Dyrealbumet</h2>
      {PAGES.map((page) => {
        const tally = pageTally(album, page.id);
        const done = tally.total > 0 && tally.found >= tally.total;
        return <div className="album-page" key={page.id}>
          <h3>
            <span aria-hidden="true">{page.emoji}</span> {page.label}
            {done
              ? <span className="medal" aria-label={`${page.label} er samlet`} role="img">🏅</span>
              : <span className="album-count">{tally.found} av {tally.total}</span>}
          </h3>
          <div className="album-row">
            {creaturesInPage(page.id).map((creature) => <AlbumCard
              key={creature.id}
              creature={creature}
              found={album.discovered.includes(creature.id)}
            />)}
          </div>
        </div>;
      })}
      {complete && <div className="finale">
        <p>🎉 Alle {CREATURES.length} dyrekortene er samlet! Rex er stolt av deg.</p>
        <button className="restart-button" type="button" onClick={startOver}>Start på nytt</button>
      </div>}
    </section>
  </main>;
}
