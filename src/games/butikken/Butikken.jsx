import { useMemo, useState } from 'react';
import { shuffle } from '../../shared/random.js';
import { speakNorwegian } from '../../shared/speech.js';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { setMuted as setAudioMuted, sounds } from './sounds.js';

export const ITEM_BANK = [
  { id: 'eple', name: 'eple', emoji: '🍎', price: 8, category: 'mat' },
  { id: 'banan', name: 'banan', emoji: '🍌', price: 6, category: 'mat' },
  { id: 'appelsin', name: 'appelsin', emoji: '🍊', price: 9, category: 'mat' },
  { id: 'druer', name: 'druer', emoji: '🍇', price: 15, category: 'mat' },
  { id: 'jordbaer', name: 'jordbær', emoji: '🍓', price: 18, category: 'mat' },
  { id: 'gulrot', name: 'gulrot', emoji: '🥕', price: 7, category: 'mat' },
  { id: 'melk', name: 'melk', emoji: '🥛', price: 14, category: 'mat' },
  { id: 'juice', name: 'juice', emoji: '🧃', price: 21, category: 'mat' },
  { id: 'brod', name: 'brød', emoji: '🍞', price: 23, category: 'mat' },
  { id: 'ost', name: 'ost', emoji: '🧀', price: 29, category: 'mat' },
  { id: 'is', name: 'is', emoji: '🍦', price: 26, category: 'mat' },
  { id: 'kanelbolle', name: 'kanelbolle', emoji: '🥐', price: 17, category: 'mat' },
  { id: 'sjokolade', name: 'sjokolade', emoji: '🍫', price: 24, category: 'mat' },
  { id: 'godteri', name: 'godteri', emoji: '🍬', price: 3, category: 'mat' },
  { id: 'popcorn', name: 'popcorn', emoji: '🍿', price: 20, category: 'mat' },
  { id: 'ball', name: 'ball', emoji: '⚽', price: 33, category: 'leker' },
  { id: 'bil', name: 'bil', emoji: '🚗', price: 36, category: 'leker' },
  { id: 'tog', name: 'tog', emoji: '🚂', price: 42, category: 'leker' },
  { id: 'bamse', name: 'bamse', emoji: '🧸', price: 48, category: 'leker' },
  { id: 'ballong', name: 'ballong', emoji: '🎈', price: 10, category: 'leker' },
  { id: 'drake', name: 'drake', emoji: '🪁', price: 45, category: 'leker' },
  { id: 'lekefly', name: 'lekefly', emoji: '✈️', price: 39, category: 'leker' },
  { id: 'helikopter', name: 'helikopter', emoji: '🚁', price: 55, category: 'leker' },
  { id: 'blyant', name: 'blyant', emoji: '✏️', price: 5, category: 'skole' },
  { id: 'linjal', name: 'linjal', emoji: '📏', price: 12, category: 'skole' },
  { id: 'bok', name: 'bok', emoji: '📕', price: 38, category: 'skole' },
  { id: 'saks', name: 'saks', emoji: '✂️', price: 19, category: 'skole' },
  { id: 'sekk', name: 'sekk', emoji: '🎒', price: 46, category: 'skole' },
  { id: 'farger', name: 'fargeblyanter', emoji: '🖍️', price: 27, category: 'skole' },
  { id: 'donald-tynn', name: 'tynt Donald-hefte', emoji: '📰', price: 12, category: 'skole' },
  { id: 'donald-middels', name: 'middels Donald-hefte', emoji: '📖', price: 29, category: 'skole' },
  { id: 'donald-tykk', name: 'tykt Donald-hefte', emoji: '📚', price: 49, category: 'skole' },
];
const WALLET_CHOICES = [50, 100, 200];
const PICKS_PER_CATEGORY = { mat: 6, leker: 4, skole: 4 };

// Trade rules: every transaction moves at most three physical items, and both
// sides of the counter have their own purse to keep honest.
export const MAX_PER_TRANSACTION = 3;
export const SELLER_START_MONEY = 400;

const ITEMS_BY_ID = new Map(ITEM_BANK.map((item) => [item.id, item]));
export function itemsFor(ids) {
  return ids.map((id) => ITEMS_BY_ID.get(id));
}

export function sumPrices(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// The policeman never repeats himself too much – one scolding per cheat try.
export const POLICE_LINES = [
  'Stopp! Prøver du å lure butikken, ja? Det går ikke!',
  'Så, så! Det regnestykket stemmer ikke, det.',
  'Politiet ser alt som skjer i butikken! Regn én gang til.',
];

export function pickPoliceLine(random = Math.random) {
  return POLICE_LINES[Math.floor(random() * POLICE_LINES.length)];
}

const CHECKOUT_META = {
  buy: {
    label: 'I kassen',
    heading: 'Hvor mye koster alle varene sammen?',
    hint: 'Du kjøper:',
  },
  sellBack: {
    label: 'Returdisken',
    heading: 'Hvor mye skal butikken betale deg for varene?',
    hint: 'Du leverer tilbake:',
  },
};

export function sampleShop() {
  const grouped = { mat: [], leker: [], skole: [] };
  ITEM_BANK.forEach((item) => grouped[item.category].push(item));
  const picked = Object.keys(PICKS_PER_CATEGORY)
    .flatMap((category) => shuffle(grouped[category]).slice(0, PICKS_PER_CATEGORY[category]));
  return shuffle(picked);
}

export function makeOptions(correct, candidates) {
  const values = new Set([correct]);
  shuffle(candidates).forEach((candidate) => {
    if (values.size >= 4 || !Number.isInteger(candidate)) return;
    if (candidate >= 0 && candidate !== correct) values.add(candidate);
  });
  let distance = 1;
  while (values.size < 4) {
    [distance, -distance].some((offset) => {
      const candidate = correct + offset;
      if (candidate >= 0 && !values.has(candidate)) values.add(candidate);
      return values.size >= 4;
    });
    distance += 1;
  }
  return shuffle([...values]);
}

export function totalDistractions(total) {
  return [Math.round(total / 10) * 10, total + 10, total - 10, total + 5, total - 5, total + 1, total - 2];
}

export function Butikken() {
  const [shopItems, setShopItems] = useState(sampleShop);
  const [ownedIds, setOwnedIds] = useState([]);
  const [buyIds, setBuyIds] = useState([]);
  const [returnIds, setReturnIds] = useState([]);
  const [walletChoice, setWalletChoice] = useState(100);
  const [customerMoney, setCustomerMoney] = useState(100);
  const [sellerMoney, setSellerMoney] = useState(SELLER_START_MONEY);
  const [soundOn, setSoundOn] = useState(true);
  const [phase, setPhase] = useState('trade');
  const [pendingKind, setPendingKind] = useState('buy');
  const [pendingIds, setPendingIds] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [policeLine, setPoliceLine] = useState(null);
  const [warn, setWarn] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [rounds, setRounds] = useState(0);

  const pendingItems = itemsFor(pendingIds);
  const pendingTotal = sumPrices(pendingItems);
  const checkoutMeta = CHECKOUT_META[pendingKind];

  const options = useMemo(() => (
    phase === 'checkout' ? makeOptions(pendingTotal, totalDistractions(pendingTotal)) : []
  ), [phase, pendingTotal]);

  function say(itemName) {
    // Selecting goods speaks their Norwegian name instead of playing a click.
    if (soundOn) speakNorwegian(itemName);
  }

  function clearTransient() {
    setCelebrate(false);
    setWarn(null);
  }

  function toggleBasket(basket, setBasket, warnSide, item) {
    clearTransient();
    if (basket.includes(item.id)) {
      setBasket(basket.filter((id) => id !== item.id));
      return;
    }
    if (basket.length >= MAX_PER_TRANSACTION) {
      setWarn({ side: warnSide, kind: 'cap' });
      return;
    }
    say(item.name);
    setBasket([...basket, item.id]);
  }

  function toggleBuy(item) {
    toggleBasket(buyIds, setBuyIds, 'buy', item);
  }

  function toggleReturn(item) {
    toggleBasket(returnIds, setReturnIds, 'sellBack', item);
  }

  function startCheckout(kind) {
    clearTransient();
    const basket = kind === 'buy' ? buyIds : returnIds;
    const items = itemsFor(basket);
    if (items.length === 0) return;
    const total = sumPrices(items);
    if (kind === 'buy' && total > customerMoney) {
      setWarn({ side: 'buy', kind: 'funds' });
      return;
    }
    if (kind === 'sellBack' && total > sellerMoney) {
      setWarn({ side: 'sellBack', kind: 'funds' });
      return;
    }
    setPendingKind(kind);
    setPendingIds(basket);
    setChosen(null);
    setPhase('checkout');
    sounds.select();
  }

  function backToTrade() {
    setPhase('trade');
    setPendingKind('buy');
    setPendingIds([]);
    setChosen(null);
    setPoliceLine(null);
    sounds.select();
  }

  function completeTransaction() {
    const movedIds = [...pendingIds];
    if (pendingKind === 'buy') {
      setCustomerMoney(customerMoney - pendingTotal);
      setSellerMoney(sellerMoney + pendingTotal);
      setOwnedIds([...ownedIds, ...movedIds]);
      setShopItems(shopItems.filter((item) => !movedIds.includes(item.id)));
    } else {
      setCustomerMoney(customerMoney + pendingTotal);
      setSellerMoney(sellerMoney - pendingTotal);
      setShopItems([...shopItems, ...itemsFor(movedIds)]);
      setOwnedIds(ownedIds.filter((id) => !movedIds.includes(id)));
    }
    setBuyIds([]);
    setReturnIds([]);
    setPendingIds([]);
    setPendingKind('buy');
    setChosen(null);
    setPoliceLine(null);
    setPhase('trade');
    setCelebrate(true);
    setRounds(rounds + 1);
    sounds.fanfare();
  }

  function answer(value) {
    if (value !== pendingTotal) {
      setChosen(value);
      setPoliceLine(pickPoliceLine());
      sounds.whistle();
      return;
    }
    completeTransaction();
  }

  function chooseWallet(amount) {
    setWalletChoice(amount);
    setCustomerMoney(amount);
    sounds.select();
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.select();
  }

  function newDay() {
    setShopItems(sampleShop());
    setOwnedIds([]);
    setBuyIds([]);
    setReturnIds([]);
    setCustomerMoney(walletChoice);
    setSellerMoney(SELLER_START_MONEY);
    setRounds(0);
    clearTransient();
    sounds.select();
  }

  function warnText(forWarn) {
    if (forWarn.kind === 'cap') return `Maks ${MAX_PER_TRANSACTION} varer per handel.`;
    if (forWarn.side === 'buy') return 'Du har ikke råd til disse varene akkurat nå – prøv med færre eller billigere varer!';
    return 'Selgeren har ikke råd til å kjøpe tilbake disse varene nå – prøv noen billigere!';
  }

  function renderShelfCard(side, item, basket, onToggle) {
    const picked = basket.includes(item.id);
    return <li key={`${side}-${item.id}`}>
      <button className={`card-toggle${picked ? ' selected' : ''}`} aria-pressed={picked} onClick={() => onToggle(item)} type="button">
        <span className="item-emoji" aria-hidden="true">{item.emoji}</span>
        <span className="item-name">{item.name}</span>
        <span className="item-price">{item.price} kr</span>
        {picked && <span className="picked-badge" aria-hidden="true">✓</span>}
              </button>
    </li>;
  }

  return <main className="game-page shop-page">
    <GameHeader title="Butikken">
      <p>Velkommen til butikken! Klikk på varene du vil kjøpe – opptil {MAX_PER_TRANSACTION} per handel. Angre du på noe, velg det på hylla di og lever det tilbake til selgeren.</p>
      <div className="game-controls">
        <span className={`rounds-chip${rounds === 0 ? ' hidden-chip' : ''}`}>🛒 {rounds} {rounds === 1 ? 'handel' : 'handler'} i dag</span>
        <div className="chip-group" role="group" aria-label="Lommeboken din">
          <span className="chip-label" aria-hidden="true">🐷</span>
          {WALLET_CHOICES.map((amount) => (
            <button className={`chip${walletChoice === amount ? ' active' : ''}`} aria-pressed={walletChoice === amount} key={amount} onClick={() => chooseWallet(amount)} type="button">{amount} kr</button>
          ))}
        </div>
        <button className="chip" onClick={newDay} type="button">🔁 Ny dag</button>
        <button className="chip toggle" aria-pressed={!soundOn} aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'} onClick={toggleSound} type="button">{soundOn ? '🔊' : '🔇'}</button>
      </div>
    </GameHeader>

    {phase === 'trade' ? (
      <section className="market-layout">
        <aside className="counter-card seller-card" aria-label="Selgeren">
          <span className="counter-avatar" aria-hidden="true">🐻</span>
          <p className="counter-role">Selgeren</p>
          <p className="counter-money"><span aria-hidden="true">💰</span> <strong>{sellerMoney} kr</strong></p>
        </aside>

        <section className="shelf-block buy-block" aria-label="Butikkhylla">
          <h2 className="shelf-title"><span aria-hidden="true">🏪</span> Butikkhylla</h2>
          <ul className="item-grid" aria-label="Varer til salgs">
            {shopItems.map((item) => renderShelfCard('shop', item, buyIds, toggleBuy))}
          </ul>
          <div className="trade-actions">
            <p className="basket-note" aria-live="polite">{buyIds.length} av {MAX_PER_TRANSACTION} valgt til kjøp</p>
            <button className="trade-button buy-button" disabled={buyIds.length === 0} onClick={() => startCheckout('buy')} type="button">Kjøp 🛒</button>
              </div>
          {warn?.side === 'buy' && <p className="warn-box" role="status">{warnText(warn)}</p>}
      </section>

        <section className="shelf-block sell-block" aria-label="Din hylle">
          <h2 className="shelf-title"><span aria-hidden="true">🧺</span> Din hylle</h2>
          <ul className="item-grid" aria-label="Varene dine">
            {ownedIds.length === 0
              ? <li className="empty-note">Tomt her ennå. Kjøp noe fra butikkhylla!</li>
              : ownedIds.map((id) => renderShelfCard('owned', itemsFor([id])[0], returnIds, toggleReturn))}
          </ul>
          <div className="trade-actions">
            <p className="basket-note" aria-live="polite">{returnIds.length} av {MAX_PER_TRANSACTION} valgt til retur</p>
            <button className="trade-button return-button" disabled={returnIds.length === 0} onClick={() => startCheckout('sellBack')} type="button">Lever tilbake ↩️</button>
          </div>
          {warn?.side === 'sellBack' && <p className="warn-box" role="status">{warnText(warn)}</p>}
        </section>

        <aside className="counter-card customer-card" aria-label="Deg som kunde">
          <span className="counter-avatar" aria-hidden="true">🐧</span>
          <p className="counter-role">Deg</p>
          <p className="counter-money"><span aria-hidden="true">💰</span> <strong>{customerMoney} kr</strong></p>
        </aside>

        {celebrate && <ConfettiLayer />}
      </section>
    ) : (
      <section className="checkout-wrap">
        <article className="checkout-card" aria-live="polite">
          <p className="panel-label">{checkoutMeta.label}</p>
          <h2>{checkoutMeta.heading}</h2>
          <p className="hint-line">{checkoutMeta.hint}</p>
          <ul className="pending-list">
            {pendingItems.map((item) => <li key={item.id}>
              <span className="line-emoji" aria-hidden="true">{item.emoji}</span>
              <span>{item.name}</span>
              <strong>{item.price} kr</strong>
            </li>)}
          </ul>
          {chosen !== null && chosen !== pendingTotal && (
            <div className="police-box" role="alert">
              <span className="police-mascot" aria-hidden="true">👮</span>
              <p className="police-line"><strong>{policeLine}</strong> Se, her peker jeg på riktig svar!</p>
              <span className="police-arm" aria-hidden="true">👇</span>
            </div>
          )}
          <div className="choices">
            {options.map((option) => {
              const isCorrect = option === pendingTotal;
              const isWrongPick = chosen === option && !isCorrect;
              const revealed = chosen !== null;
              return <button
                key={option}
                type="button"
                className={`choice-btn${revealed && isCorrect ? ' pointed' : ''}${isWrongPick ? ' crossed' : ''}`}
                disabled={revealed && !isCorrect}
                onClick={() => answer(option)}
              >
                {revealed && isCorrect && <span className="point-marker" aria-hidden="true">👉</span>}
                {option} kr
                {isWrongPick && <span aria-hidden="true"> ❌</span>}
              </button>;
            })}
          </div>
          <button className="link-back" onClick={backToTrade} type="button">← Tilbake til butikken</button>
        </article>
      </section>
    )}
  </main>;
}
