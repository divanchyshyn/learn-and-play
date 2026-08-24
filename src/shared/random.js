// Small randomness helpers shared by every game. They honour a mocked
// Math.random, which keeps game tests deterministic.

// Fisher–Yates: returns a shuffled copy and never mutates the input.
export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

// One uniform pick from a non-empty list.
export function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}
