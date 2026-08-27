import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react';
import { Butikken, MAX_PER_TRANSACTION, SELLER_START_MONEY, START_MONEY } from './Butikken.jsx';
afterEach(() => {
  cleanup();
});

// Shelves are labelled sections – look them up by aria-label and read whatever
// random goods were dealt onto them instead of assuming specific items.
function shelf(view, label) {
  const element = view.container.querySelector(`[aria-label="${label}"]`);
  expect(element).toBeTruthy();
  return element;
}

function cardsIn(shelfElement) {
  return [...shelfElement.querySelectorAll('.card-toggle')].map((button) => ({
    button,
    name: button.querySelector('.item-name').textContent,
    price: Number(button.querySelector('.item-price').textContent.match(/\d+/)[0]),
  }));
}

function cardByPrice(shelfElement, rankFromCheapest) {
  return cardsIn(shelfElement).sort((a, b) => a.price - b.price)[rankFromCheapest];
}

function purse(view, who) {
  return view.container.querySelector(`[aria-label="${who}"]`);
}

// Type an answer into the checkout field and press the Svar button.
function giveAnswer(value) {
  fireEvent.change(document.querySelector('.answer-input'), { target: { value: String(value) } });
  fireEvent.click(screen.getByRole('button', { name: 'Svar' }));
}

describe('butikken shopping flow', () => {
  it('collects up to three items and never shows a running total', () => {
    const view = render(<Butikken />);
    const shopShelf = shelf(view, 'Varer til salgs');
    const [cheapest, second] = cardsIn(shopShelf).sort((a, b) => a.price - b.price);

    fireEvent.click(cheapest.button);
    fireEvent.click(second.button);

    expect(within(shopShelf).getByText(`${cheapest.name}`)).toBeInTheDocument();
    expect(screen.getByText('2 av 3 valgt til kjøp')).toBeInTheDocument();
    expect(view.container.textContent).not.toContain('Samlet');
    expect(view.container.querySelector('.cart-total')).toBeNull();

    fireEvent.click(second.button); // deselecting works too
    expect(screen.getByText('1 av 3 valgt til kjøp')).toBeInTheDocument();
  });

  it('refuses a fourth item and explains the limit', () => {
    const view = render(<Butikken />);
    const shopShelf = shelf(view, 'Varer til salgs');
    const four = cardsIn(shopShelf)
      .sort((a, b) => a.price - b.price)
      .slice(0, MAX_PER_TRANSACTION + 1);

    four.slice(0, MAX_PER_TRANSACTION).forEach((card) => fireEvent.click(card.button));
    expect(screen.queryByText(/Maks 3 varer per handel/)).not.toBeInTheDocument();

    fireEvent.click(four[MAX_PER_TRANSACTION].button);
    expect(screen.getByText(`Maks ${MAX_PER_TRANSACTION} varer per handel.`)).toBeInTheDocument();
    expect(document.querySelectorAll('.card-toggle.selected')).toHaveLength(MAX_PER_TRANSACTION);
  });
it('sells goods over the counter and moves them to the customer shelf', () => {
    const view = render(<Butikken />);
    const [cheapest, second] = cardsIn(shelf(view, 'Varer til salgs')).sort((a, b) => a.price - b.price);
    const total = cheapest.price + second.price;

    fireEvent.click(cheapest.button);
    fireEvent.click(second.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    expect(screen.getByText('Hvor mye koster alle varene sammen?')).toBeInTheDocument();
    giveAnswer(total);

    const ownedShelf = shelf(view, 'Varene dine');
    expect(cardsIn(ownedShelf).map((card) => card.name).sort()).toEqual([cheapest.name, second.name].sort());
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${START_MONEY - total} kr`);
    expect(purse(view, 'Selgeren').textContent).toContain(`${SELLER_START_MONEY + total} kr`);
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    expect(screen.getByText(/1 handel i dag/)).toBeInTheDocument();
  });

  it('asks a subtraction puzzle when buying just one item', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));

    // The task is "how much is left of your 100 kr", not the printed price.
    expect(screen.getByText('Hvor mye har du igjen?')).toBeInTheDocument();
    // The current purse is shown big and highlighted at the checkout…
    const purseEl = view.container.querySelector('.checkout-purse');
    expect(purseEl).toBeTruthy();
    expect(purseEl.textContent).toContain(`${START_MONEY} kr`);
    // …and the hint names the single item and its price.
    expect(view.container.textContent).toContain(
      `Du kjøper ${cheapest.name} for ${cheapest.price} kr.`,
    );
    const expected = START_MONEY - cheapest.price;
    giveAnswer(expected);

    expect(shelf(view, 'Varene dine').textContent).toContain(cheapest.name);
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${expected} kr`);
  });
it('shows the current purse highlighted at a later checkout, even after money is spent', () => {
    const view = render(<Butikken />);
    const first = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    // Spend once, so the purse is no longer the opening 100 kr.
    fireEvent.click(first.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    const leftAfterFirst = START_MONEY - first.price;
    giveAnswer(leftAfterFirst);
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${leftAfterFirst} kr`);

    // A second purchase – this time a two-item (sum) checkout – still shows the
    // current, now-reduced purse, highlighted at the top.
    const [a, b] = cardsIn(shelf(view, 'Varer til salgs')).sort((x, y) => x.price - y.price);
    fireEvent.click(a.button);
    fireEvent.click(b.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));

    expect(screen.getByText('Hvor mye koster alle varene sammen?')).toBeInTheDocument();
    const purseEl = view.container.querySelector('.checkout-purse');
    expect(purseEl).toBeTruthy();
    expect(purseEl.textContent).toContain(`${leftAfterFirst} kr`);
    expect(purseEl.textContent).not.toContain(`${START_MONEY} kr`);
  });
it('shows a policeman without revealing the answer, then three wrong tries send you back', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    const correct = START_MONEY - cheapest.price;

    // First wrong try: the policeman appears, but the right answer is not revealed.
    giveAnswer(correct + 5);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(document.querySelector('.police-mascot').textContent).toBe('👮');
    expect(view.container.textContent).not.toContain(`${correct} kr`);
    expect(view.container.querySelector('.pointed')).toBeNull();
    expect(view.container.querySelector('.point-marker')).toBeNull();
    expect(document.querySelector('.police-note').textContent).toContain('2 forsøk igjen');

    // Second wrong: one attempt left.
    giveAnswer(correct + 3);
    expect(document.querySelector('.police-note').textContent).toContain('1 forsøk igjen');

    // Third wrong: the deal is off, the basket is cleared, back to the shop.
    giveAnswer(correct + 1);
    expect(screen.queryByText('Hvor mye har du igjen?')).not.toBeInTheDocument();
    expect(screen.getByText('0 av 3 valgt til kjøp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kjøp/ })).toBeInTheDocument();
  });

  it('lets the generous starting purse afford even the dearest basket', () => {
    const view = render(<Butikken />);
    const dearestThree = cardsIn(shelf(view, 'Varer til salgs'))
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
    const total = dearestThree.reduce((sum, card) => sum + card.price, 0);
    // With the starting purse at 900, the dearest possible basket still fits.
    expect(total).toBeLessThan(START_MONEY);

    dearestThree.forEach((card) => fireEvent.click(card.button));
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));

    // The sale is allowed instead of being blocked for lack of funds.
    expect(view.container.textContent).not.toContain('Du har ikke råd til disse varene');
    expect(screen.getByText('Hvor mye koster alle varene sammen?')).toBeInTheDocument();
    giveAnswer(total);
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${START_MONEY - total} kr`);
    expect(purse(view, 'Selgeren').textContent).toContain(`${total} kr`);
  });

  it('lets the customer return items and get the money back', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    // Buy a single item – a subtraction question…
    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    giveAnswer(START_MONEY - cheapest.price);
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${START_MONEY - cheapest.price} kr`);

    // …then regret it and sell it back – a single return asks how much you will
    // hold once the item's price is added back.
    const ownedCard = cardByPrice(shelf(view, 'Varene dine'), 0);
    expect(ownedCard.name).toBe(cheapest.name);
    fireEvent.click(ownedCard.button);
    fireEvent.click(screen.getByRole('button', { name: /Lever tilbake/ }));
    expect(screen.getByText('Hvor mye har du etter returen?')).toBeInTheDocument();
    giveAnswer(START_MONEY); // (START_MONEY - price) + price

    expect(cardsIn(shelf(view, 'Varer til salgs')).some((card) => card.name === cheapest.name)).toBe(true);
    expect(shelf(view, 'Varene dine').textContent).toContain('Tomt her ennå');
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${START_MONEY} kr`);
    expect(purse(view, 'Selgeren').textContent).toContain(`${SELLER_START_MONEY} kr`);
  });
it('starts a fresh day on demand', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    giveAnswer(START_MONEY - cheapest.price);
    fireEvent.click(screen.getByRole('button', { name: '🔁 Ny dag' }));

    expect(shelf(view, 'Varene dine').textContent).toContain('Tomt her ennå');
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${START_MONEY} kr`);
    expect(purse(view, 'Selgeren').textContent).toContain(`${SELLER_START_MONEY} kr`);
    const roundsChip = screen.getByText(/handler i dag/);
    expect(roundsChip.textContent).toBe('🛒 0 handler i dag');
    expect(roundsChip.className).toContain('hidden-chip');
  });

  it('speaks the norwegian item name when selected, unless muted', () => {
    const spoken = [];
    window.SpeechSynthesisUtterance = class FakeUtterance {
      constructor(text) { this.text = text; }
    };
    window.speechSynthesis = {
      getVoices: () => [{ lang: 'nb-NO', name: 'Bokmål' }],
      cancel() {},
      speak(utterance) { spoken.push(utterance); },
    };

    try {
      const view = render(<Butikken />);
      const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);
      fireEvent.click(cheapest.button);
      expect(spoken).toHaveLength(1);
      expect(spoken[0].text).toBe(cheapest.name);

      fireEvent.click(screen.getByRole('button', { name: 'Slå av lyd' })); // mute
      fireEvent.click(cheapest.button); // deselect
      fireEvent.click(cheapest.button); // select again while muted
      expect(spoken).toHaveLength(1);
    } finally {
      delete window.speechSynthesis;
      delete window.SpeechSynthesisUtterance;
    }
  });

  it('keeps the checkout escapable without answering', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tilbake til butikken/ }));

    expect(screen.queryByText('Hvor mye koster alle varene sammen?')).not.toBeInTheDocument();
    expect(screen.getByText('1 av 3 valgt til kjøp')).toBeInTheDocument();
  });
});