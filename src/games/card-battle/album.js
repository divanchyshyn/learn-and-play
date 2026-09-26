import { CREATURES, creatureById, creaturesInPage } from './riddles.js';

// The album is what a child builds by solving riddles: every solved riddle
// flips one animal card face up, and the whole collection survives a page
// reload. Cards are stored by their English id rather than by a position, so
// the roster may grow (or be reordered) without a saved album ever losing a
// found animal.
export const ALBUM_KEY = 'cardBattle:album';
const ALBUM_VERSION = 1;

export function createAlbum() {
  return { discovered: [] };
}

export function foundCount(album) {
  return album.discovered.length;
}

export function albumComplete(album) {
  return foundCount(album) >= CREATURES.length;
}

// The first animal still missing, in roster order, so the pages fill from the
// forest to the savanna even when storage arrived out of order or half full.
export function nextCreature(album) {
  return CREATURES.find((entry) => !album.discovered.includes(entry.id)) ?? null;
}

// Record one found animal. Unknown ids and repeats leave the album untouched
// (the very same object), so a repeat solve never writes storage for nothing.
export function discoverCreature(album, creatureId) {
  if (!creatureById(creatureId)) return album;
  if (album.discovered.includes(creatureId)) return album;
  return { discovered: [...album.discovered, creatureId] };
}

// How full one page is, against the animals the roster puts on it.
export function pageTally(album, pageId) {
  const ids = creaturesInPage(pageId).map((entry) => entry.id);
  const found = ids.filter((id) => album.discovered.includes(id)).length;
  return { found, total: ids.length };
}

function normalizeDiscovered(discovered) {
  if (!Array.isArray(discovered)) return [];
  const seen = new Set();
  const normalized = [];
  for (const id of discovered) {
    if (typeof id !== 'string' || !creatureById(id) || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

export const albumCodec = {
  serialize(album) {
    return JSON.stringify({ version: ALBUM_VERSION, album });
  },
  parse(raw) {
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== ALBUM_VERSION) return null;
      const saved = data.album;
      if (!saved || typeof saved !== 'object') return null;
      return { discovered: normalizeDiscovered(saved.discovered) };
    } catch {
      return null;
    }
  },
};
