import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react';
import { Butikken } from './Butikken.jsx';

afterEach(() => {
  cleanup();
});

// The shop deals 12 random items each round, so tests read whatever is on
// the shelf instead of assuming specific goods.
function getShelfItems(view) {
  return [...view.container.querySelectorAll('.item-card')].map((card) => ({
    name: card.querySelector('.item-name').textContent,
    price: Number(card.querySelector('.item-price').textContent.match(/\d+/)[0]),
  }));
}

function addItem(view, name, times = 1) {
  // Accessible names concatenate the spans without whitespace ("eple8 kr…").
  const button = screen.getByRole('button', { name: new RegExp(`${name}\\s*\\d+\\s*kr`) });
  for (let i = 0; i < times; i += 1) fireEvent.click(button);
}

// The card's own remove button – the cart also has steppers with similar labels.
function removeOne(view, itemName) {
  const cards = [...view.container.querySelectorAll('.item-card')];
  const card = cards.find((element) => element.textContent.includes(itemName));
  fireEvent.click(card.querySelector('.item-remove'));
}

// Both the cart panel and the mobile pay bar contain a "Betal" button;
// they do exactly the same thing, so the first one is fine.
function pay() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Betal' })[0]);
}

describe('butikken shopping flow', () => {
  it('collects items in the cart and shows the running total', () => {
    const view = render(<Butikken />);
    const shelf = getShelfItems(view).sort((a, b) => a.price - b.price);
    const [first, second] = shelf;

    addItem(view, first.name, 2);
    addItem(view, second.name);
    const total = 2 * first.price + second.price;

    expect(screen.getByText(`2 × ${first.name}`)).toBeInTheDocument();
    expect(screen.getByText(`1 × ${second.name}`)).toBeInTheDocument();
    expect(screen.getByText(`${total} kr`)).toBeInTheDocument();
    expect(screen.getByText(/3 varer/)).toBeInTheDocument();
  });

  it('removes a single item with the minus button on the card', () => {
    const view = render(<Butikken />);
    const shelf = getShelfItems(view).sort((a, b) => a.price - b.price);
    const item = shelf[0];

    addItem(view, item.name, 2);
    removeOne(view, item.name);

    expect(screen.getByText(`1 × ${item.name}`)).toBeInTheDocument();
    // Scope to the line sum – the card price and the running total may show
    // the same amount.
    expect(within(screen.getByLabelText('Handlekurven')).getByText(`${item.price} kr`, { selector: '.line-sum' })).toBeInTheDocument();
  });

  it('checks out straight to change when sums are visible, then celebrates', () => {
    const view = render(<Butikken />);
    const shelf = getShelfItems(view).sort((a, b) => a.price - b.price);
    const [first, second] = shelf;

    addItem(view, first.name, 2);
    addItem(view, second.name);
    const total = 2 * first.price + second.price;
    const change = 100 - total;

    pay();

    // Totals are visible by default, so the game only asks for the change.
    expect(screen.queryByText('Hvor mye koster alle varene sammen?')).not.toBeInTheDocument();
    expect(screen.getByText(`Du betaler ${total} kr med 100 kr.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `${change} kr` }));

    expect(screen.getByText(/riktig/i)).toBeInTheDocument();
    expect(screen.getByText(/Takk for handelen!/)).toBeInTheDocument();
    expect(document.querySelector('.confetti-layer')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Ny handel/ }));
    expect(screen.getByText(/Handlekurven er tom/)).toBeInTheDocument();
  });

  it('asks for the total first when the sums are hidden', () => {
    const view = render(<Butikken />);
    const shelf = getShelfItems(view).sort((a, b) => a.price - b.price);
    const [first, second] = shelf;

    addItem(view, first.name);
    addItem(view, second.name);
    const total = first.price + second.price;
    const change = 100 - total;

    fireEvent.click(screen.getByRole('button', { name: /Sum: synlig/ })); // hide totals
    pay();

    expect(screen.getByText('Hvor mye koster alle varene sammen?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `${total} kr` }));

    expect(screen.getByText(/fint regnet!/)).toBeInTheDocument();
    expect(screen.getByText('Hvor mye får du tilbake?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `${change} kr` }));

    expect(screen.getByText(/riktig/i)).toBeInTheDocument();
  });

  it('lends extra money at the till when the wallet is too small', () => {
    const view = render(<Butikken />);
    const priciest = getShelfItems(view).sort((a, b) => b.price - a.price)[0];

    // Three of the most expensive item always overshoots the 100 kr wallet.
    addItem(view, priciest.name, 3);
    const total = priciest.price * 3;
    expect(total).toBeGreaterThan(100);

    pay();
    // The sentence is split across <strong> children, so match on textContent.
    const fundsBox = view.container.querySelector('.funds-box');
    expect(fundsBox.textContent).toContain(`Varene koster ${total} kr`);

    // The shop tops the wallet up to the next 50 kr multiple.
    fireEvent.click(screen.getByRole('button', { name: 'Få ekstra penger' }));
    const toppedUp = Math.ceil((total + 1) / 50) * 50;

    expect(screen.getByText(`Du betaler ${total} kr med ${toppedUp} kr.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `${toppedUp - total} kr` }));

    expect(screen.getByText(/riktig/i)).toBeInTheDocument();
    expect(view.container.textContent).toContain(`nå har du ${toppedUp} kr`);
  });

  it('lets the shopper go back and remove items instead of borrowing', () => {
    const view = render(<Butikken />);
    const priciest = getShelfItems(view).sort((a, b) => b.price - a.price)[0];

    addItem(view, priciest.name, 3);
    pay();
    fireEvent.click(screen.getByRole('button', { name: 'Legge noe tilbake' }));

    expect(screen.getByText(/Handlekurven/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: new RegExp(`${priciest.name}\\s*${priciest.price}\\s*kr`) })).toHaveLength(1);
  });
});
