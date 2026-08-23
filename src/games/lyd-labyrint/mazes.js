// Hand-built mazes. Every maze is a chain of junctions: at each junction one
// door (uppercase) leads onward and the other (lowercase) is a one-cell stub,
// so a "wrong" choice only ever costs a single bounce-back – never a detour.
//
// Map legend:
//   #  wall          .  floor
//   S  start         X  exit
//   A-F  correct doors   a-f  bounce-back doors

const MAZE_DEFS = [
  {
    name: 'Skogen',
    theme: 'skog',
    map: `
#############
#####X#######
#####.#######
#####D#######
####d....C.##
##########.##
##########.##
#####a####B##
#S....A....b#
#############
#############
`,
  },
  {
    name: 'Havet',
    theme: 'hav',
    map: `
#############
#b###########
#.B.....c####
#.#####C#####
#.#####.#####
#A#####.#####
#.a####.###X#
#.#####.###E#
#.#####.D...#
#.#####d###e#
#.###########
#S###########
#############
`,
  },
  {
    name: 'Verdensrommet',
    theme: 'rom',
    map: `
###########
#S...a#####
####A######
####.######
####.f#####
#c...#.F.X#
#..B.#.####
#C##b#.####
#.####.####
#.####Ee###
#d.....####
###########
###########
###########
###########
`,
  },
];

function parseMaze(def) {
  const rows = def.map.split('\n').filter((row) => row.length > 0);
  const height = rows.length;
  const width = rows[0].length;
  const floors = new Set();
  const doors = [];
  let start = null;
  let exit = null;

  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') return;
      floors.add(`${x},${y}`);
      if (ch === 'S') start = { x, y };
      else if (ch === 'X') exit = { x, y };
      else if (ch === '.') { /* plain floor */ }
      else if (ch >= 'A' && ch <= 'Z') doors.push({ x, y, ok: true });
      else doors.push({ x, y, ok: false });
    });
  });

  return { name: def.name, theme: def.theme, width, height, floors, doors, start, exit };
}

export const MAZES = MAZE_DEFS.map(parseMaze);
