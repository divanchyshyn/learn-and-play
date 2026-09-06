import { useEffect, useState } from 'react';
import { readStorage, writeStorage } from './persistence.js';

// A useState that survives a page refresh. The state is read from localStorage
// on first mount (via `codec.parse`) and every change is written back (via
// `codec.serialize`), so a game can swap one `useState` for this hook and its
// durable state starts surviving reloads. No storage (or a corrupt saved
// value) falls back to `initial()` exactly like a lazy useState initializer.
//
//   usePersistentState(key, () => freshState(), codec)
//
// `codec` must be a stable reference across renders (a module-level constant
// per game) so the write-back effect only runs when the value changes.
export function usePersistentState(key, initial, codec) {
  const [value, setValue] = useState(() => {
    const raw = readStorage(key);
    if (raw === null) return initial();
    return codec.parse(raw) ?? initial();
  });

  useEffect(() => {
    writeStorage(key, codec.serialize(value));
  }, [key, value, codec]);

  return [value, setValue];
}