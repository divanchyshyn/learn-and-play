import { useMemo, useState } from 'react';
import { shuffle } from '../../shared/random.js';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { setMuted as setAudioMuted, sounds } from './sounds.js';

const ITEM_BANK = [
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
  { id: 'blyant', name: 'blyant', emoji: '✏️', price: 5, category: 'skole' },
  { id: 'linjal', name: 'linjal', emoji: '📏', price: 12, category: 'skole' },
  { id: 'bok', name: 'bok', emoji: '📕', price: 38, category: 'skole' },
  { id: 'saks', name: 'saks', emoji: '✂️', price: 19, category: 'skole' },
  { id: 'sekk', name: 'sekk', emoji: '🎒', price: 46, category: 'skole' },
  { id: 'farger', name: 'fargeblyanter', emoji: '🖍️', price: 27, category: 'skole' },
];
const WALLET_CHOICES = [50, 100, 200];
const PICKS_PER_CATEGORY = { mat: 6, leker: 3, skole: 3 };

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

export function changeDistractions(wallet, total, correct) {
  return [total, wallet + correct, correct + 10, correct - 10, correct + 5, correct - 5, correct + 2, correct - 1];
}

export function totalDistractions(total) {
  return [Math.round(total / 10) * 10, total + 10, total - 10, total + 5, total - 5, total + 1, total - 2];
}

export function Butikken() {
  const [shopItems, setShopItems] = useState(sampleShop);
  const [cart, setCart] = useState({});
  const [walletChoice, setWalletChoice] = useState(100);
  const [wallet, setWallet] = useState(100);
  const [showTotals, setShowTotals] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [phase, setPhase] = useState('shop');
  const [step, setStep] = useState('ask-change');
  const [chosen, setChosen] = useState(null);
  const [rounds, setRounds] = useState(0);

  const lines = shopItems.filter((item) => cart[item.id]).map((item) => ({ ...item, qty: cart[item.id] }));
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const correctChange = wallet - total;
  const affordable = total <= wallet;
  const matched = chosen === correctChange;

  // Choices are derived from live state so they stay valid if the wallet
  // changes mid-checkout (e.g. after borrowing extra money from the shop).
  const options = useMemo(() => {
    if (phase !== 'checkout' || !affordable || step === 'reveal') return [];
    if (step === 'ask-total') return makeOptions(total, totalDistractions(total));
    return makeOptions(correctChange, changeDistractions(wallet, total, correctChange));
  }, [phase, affordable, step, total, wallet, correctChange]);

  function addItem(item) {
    setCart((current) => ({ ...current, [item.id]: (current[item.id] || 0) + 1 }));
    sounds.pop();
  }

  function removeOne(itemId) {
    setCart((current) => ({ ...current, [itemId]: Math.max(0, (current[itemId] || 0) - 1) }));
    sounds.tick();
  }

  function chooseWallet(amount) {
    setWalletChoice(amount);
    setWallet(amount);
    sounds.select();
  }

  function toggleTotals() {
    setShowTotals((visible) => !visible);
    sounds.select();
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.pop();
  }

  function goToCheckout() {
    setChosen(null);
    setStep(showTotals ? 'ask-change' : 'ask-total');
    setPhase('checkout');
    sounds.select();
  }

  function backToShop() {
    setPhase('shop');
    sounds.tick();
  }

  function topUpWallet() {
    setWallet(Math.ceil((total + 1) / 50) * 50);
    sounds.pop();
  }

  function answerTotal(value) {
    setChosen(value);
    sounds.success();
    setStep('ask-change');
  }

  function answerChange(value) {
    setChosen(value);
    sounds.fanfare();
    setStep('reveal');
    setRounds((count) => count + 1);
  }

  function newRound() {
    setShopItems(sampleShop());
    setCart({});
    setWallet(walletChoice);
    setPhase('shop');
    setChosen(null);
    sounds.select();
  }

  return <main className="game-page shop-page">
    <GameHeader title="Butikken">
      <p>Velkommen til butikken! Klikk på varene du vil kjøpe, og gå til kassen når handlekurven er klar.</p>
      <div className="game-controls">
        <span className={`rounds-chip${rounds === 0 ? ' hidden-chip' : ''}`}>🛒 {rounds} {rounds === 1 ? 'handel' : 'handler'} i dag</span>
        <div className="chip-group" role="group" aria-label="Penger i lommeboken">
          <span className="chip-label" aria-hidden="true">🐷</span>
          {WALLET_CHOICES.map((amount) => (
            <button className={`chip${walletChoice === amount ? ' active' : ''}`} aria-pressed={walletChoice === amount} key={amount} onClick={() => chooseWallet(amount)} type="button">{amount} kr</button>
          ))}
        </div>
        <button className="chip toggle" aria-pressed={showTotals} onClick={toggleTotals} type="button">{showTotals ? '👁 Sum: synlig' : '🙈 Sum: gjemt'}</button>
        <button className="chip toggle" aria-pressed={!soundOn} aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'} onClick={toggleSound} type="button">{soundOn ? '🔊' : '🔇'}</button>
      </div>
    </GameHeader>

    {phase === 'shop' ? (
      <section className="shop-layout">
        <div className="shop-grid" aria-label="Varer i butikken">
          {shopItems.map((item) => {
            const qty = cart[item.id] || 0;
            return <div className={`item-card${qty > 0 ? ' in-cart' : ''}`} key={item.id}>
              <button className="card-add" onClick={() => addItem(item)} type="button">
                <span className="item-emoji" aria-hidden="true">{item.emoji}</span>
                <span className="item-name">{item.name}</span>
                <span className="item-price">{item.price} kr</span>
                <span className="visually-hidden">{qty > 0 ? `Du har ${qty} i handlekurven` : 'Ikke i handlekurven ennå'}</span>
              </button>
              {qty > 0 && <>
                <span className="item-qty" aria-hidden="true" key={`qty-${qty}`}>{qty}</span>
                <button className="item-remove" aria-label={`Ta ut én ${item.name}`} onClick={() => removeOne(item.id)} type="button">−</button>
              </>}
            </div>;
          })}
        </div>

        <aside className="cart-panel" aria-label="Handlekurven">
          <p className="panel-label">Handlekurven</p>
          <p className="wallet-line"><span aria-hidden="true">🐷</span> Du har <strong>{wallet} kr</strong></p>
          {lines.length === 0
            ? <p className="empty-note">Handlekurven er tom. Klikk på det du vil kjøpe!</p>
            : <ul className="cart-lines">
              {lines.map((line) => <li key={line.id}>
                <span className="line-emoji" aria-hidden="true">{line.emoji}</span>
                <span className="line-name">{line.qty} × {line.name}</span>
                <span className="steppers">
                  <button className="stepper" aria-label={`Ta ut én ${line.name}`} onClick={() => removeOne(line.id)} type="button">−</button>
                  <button className="stepper" aria-label={`Legg i én ${line.name} til`} onClick={() => addItem(line)} type="button">+</button>
                </span>
                <span className="line-sum">{line.price * line.qty} kr</span>
              </li>)}
            </ul>}
          <p className="cart-total"><span>Samlet:</span><strong>{showTotals ? `${total} kr` : '? kr'}</strong></p>
          <button className="pay-button" onClick={goToCheckout} type="button">Betal</button>
        </aside>
      </section>
    ) : (
      <section className="checkout-wrap">
        <article className="checkout-card" aria-live="polite">
          <p className="panel-label">Kassen</p>
          {!affordable && step !== 'reveal' ? (
            <div className="funds-box">
              <p className="funds-mascot" aria-hidden="true">🐧</p>
              <p>Varene koster <strong>{total} kr</strong>, men du har bare <strong>{wallet} kr</strong>.</p>
              <p>Vil du legge noe tilbake i hylla – eller låne litt ekstra av butikken?</p>
              <div className="funds-actions">
                <button className="outline-button" onClick={backToShop} type="button">Legge noe tilbake</button>
                <button className="roll-button" onClick={topUpWallet} type="button">Få ekstra penger</button>
              </div>
            </div>
          ) : step === 'ask-total' ? (
            <>
              <h2>Hvor mye koster alle varene sammen?</h2>
              <div className="choices">
                {options.map((option) => <button className="choice-btn" key={option} onClick={() => answerTotal(option)} type="button">{option} kr</button>)}
              </div>
            </>
          ) : step === 'ask-change' ? (
            <>
              <h2>Du betaler {total} kr med {wallet} kr.</h2>
              {!showTotals && chosen !== null && <p className="total-reveal">Varene koster {total} kr – fint regnet!</p>}
              <p className="question-line">Hvor mye får du tilbake?</p>
              <div className="choices">
                {options.map((option) => <button className="choice-btn" key={option} onClick={() => answerChange(option)} type="button">{option} kr</button>)}
              </div>
            </>
          ) : (
            <>
              <div className="reveal-box">
                <h2 className={matched ? 'good' : ''}>{matched ? `🎉 ${chosen} kr – riktig!` : `Riktig svar er ${correctChange} kr.`}</h2>
                <p>{matched ? `Du får ${correctChange} kr tilbake.` : 'Takk for at du ville regne med meg!'}</p>
              </div>
              {wallet > walletChoice && <p className="loan-note">Butikken lånte deg litt ekstra – nå har du {wallet} kr.</p>}
              <div className="thanks-row"><span className="mascot" aria-hidden="true">🐧</span><p>Takk for handelen!</p></div>
              <button className="pay-button" onClick={newRound} type="button">Ny handel 🛍️</button>
            </>
          )}
          {step !== 'reveal' && <button className="link-back" onClick={backToShop} type="button">← Tilbake til butikken</button>}
        </article>
      </section>
    )}

    {phase === 'shop' && <div className="mobile-paybar" aria-hidden="true">
      <span className="bar-sum">🛒 {itemCount} varer · {showTotals ? `${total} kr` : '?'}</span>
      <button className="pay-button bar-button" tabIndex={-1} onClick={goToCheckout} type="button">Betal</button>
    </div>}

    {phase === 'checkout' && step === 'reveal' && <ConfettiLayer />}
  </main>;
}
