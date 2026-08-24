import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react';
import { Butikken, MAX_PER_TRANSACTION, SELLER_START_MONEY } from './Butikken.jsx';
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

describe('butikken shopping flow', () => {
  it('collects up to three items and never shows a running total', () => {
    const view = render(<Butikken />);
    const shopShelf = shelf(view, 'Varer til salgs');
    const [cheapest, second] = cardsIn(shopShelf).sort((a, b) => a.price - b.price);

    fireEvent.click(cheapest.button);
    fireEvent.click(second.button);

    expect(within(shopShelf).getByText(`${cheapest.name}`)).toBeInTheDocument();
    expect(screen.getByText('2 av 3 valgt til kjøp')).toBeInTheDocument();
    // No sums of selected goods anywhere on the trading floor.
    expect(view.container.textContent).not.toContain('Samlet');
    expect(view.container.querySelector('.cart-total')).toBeNull();
    expect(view.container.textContent).not.toContain('? kr');

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
    fireEvent.click(screen.getByRole('button', { name: `${total} kr` }));

    const ownedShelf = shelf(view, 'Varene dine');
    expect(cardsIn(ownedShelf).map((card) => card.name).sort()).toEqual([cheapest.name, second.name].sort());
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${100 - total} kr`);
    expect(purse(view, 'Selgeren').textContent).toContain(`${SELLER_START_MONEY + total} kr`);
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    expect(screen.getByText(/1 handel i dag/)).toBeInTheDocument();
  });

  it('shows a policeman pointing at the right answer after a wrong guess', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    const wrong = [...document.querySelectorAll('.choice-btn')].find(
      (button) => !button.textContent.includes(`${cheapest.price} kr`),
    );
    fireEvent.click(wrong);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(document.querySelector('.police-mascot').textContent).toBe('👮');
    const pointed = document.querySelector('.choice-btn.pointed');
    expect(pointed).toBeTruthy();
    expect(pointed.textContent).toContain(`${cheapest.price} kr`);
    expect(pointed.textContent).toContain('👉');
    expect(pointed.disabled).toBe(false);
    // Every non-answer is locked away once the policeman steps in.
    [...document.querySelectorAll('.choice-btn')]
      .filter((button) => button !== pointed)
      .forEach((button) => expect(button.disabled).toBe(true));
    expect(wrong.className).toContain('crossed');

    fireEvent.click(pointed);
    expect(shelf(view, 'Varene dine').textContent).toContain(cheapest.name);
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${100 - cheapest.price} kr`);
  });

  it('blocks buying when the customer cannot afford it', () => {
    const view = render(<Butikken />);
    const dearestThree = cardsIn(shelf(view, 'Varer til salgs'))
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
    expect(dearestThree.reduce((sum, card) => sum + card.price, 0)).toBeGreaterThan(100);

    dearestThree.forEach((card) => fireEvent.click(card.button));
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));

    expect(view.container.textContent).toContain('Du har ikke råd til disse varene');
    expect(screen.queryByText('Hvor mye koster alle varene sammen?')).not.toBeInTheDocument();
  });

  it('lets the customer return items and get the money back', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    // Buy first…
    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    fireEvent.click(screen.getByRole('button', { name: `${cheapest.price} kr` }));
    expect(purse(view, 'Deg som kunde').textContent).toContain(`${100 - cheapest.price} kr`);

    // …then regret it and sell it back.
    const ownedCard = cardByPrice(shelf(view, 'Varene dine'), 0);
    expect(ownedCard.name).toBe(cheapest.name);
    fireEvent.click(ownedCard.button);
    fireEvent.click(screen.getByRole('button', { name: /Lever tilbake/ }));
    expect(screen.getByText('Hvor mye skal butikken betale deg for varene?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `${cheapest.price} kr` }));

    expect(cardsIn(shelf(view, 'Varer til salgs')).some((card) => card.name === cheapest.name)).toBe(true);
    expect(shelf(view, 'Varene dine').textContent).toContain('Tomt her ennå');
    expect(purse(view, 'Deg som kunde').textContent).toContain('100 kr');
    expect(purse(view, 'Selgeren').textContent).toContain(`${SELLER_START_MONEY} kr`);
  });

  it('starts a fresh day on demand', () => {
    const view = render(<Butikken />);
    const cheapest = cardByPrice(shelf(view, 'Varer til salgs'), 0);

    fireEvent.click(cheapest.button);
    fireEvent.click(screen.getByRole('button', { name: /Kjøp/ }));
    fireEvent.click(screen.getByRole('button', { name: `${cheapest.price} kr` }));
    fireEvent.click(screen.getByRole('button', { name: '🔁 Ny dag' }));

    expect(shelf(view, 'Varene dine').textContent).toContain('Tomt her ennå');
    expect(purse(view, 'Deg som kunde').textContent).toContain('100 kr');
    expect(purse(view, 'Selgeren').textContent).toContain(`${SELLER_START_MONEY} kr`);
    const roundsChip = screen.getByText(/handler i dag/);
    expect(roundsChip.textContent).toBe('🛒 0 handler i dag');
    expect(roundsChip.className).toContain('hidden-chip');
  });

  it('speaks the norwegian item name when it is selected, unless muted', () => {
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
      expect(spoken[0].lang).toBe('nb-NO');

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
    // The half-made purchase stays in the basket for another try.
    expect(screen.getByText('1 av 3 valgt til kjøp')).toBeInTheDocument();
  });
});
