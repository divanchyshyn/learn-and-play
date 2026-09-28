import { PHOTOS } from './photos.js';

// The sky above the waterline: a photographed dawn sky – the sun is already in
// the picture – with clouds drifting across it and a couple of gulls.
//
// The plate holds the sky on its own: it is the dawn photograph cut off along its
// own horizon row, so it is pasted with `cover` and anchored to its bottom edge,
// which lands that horizon on the waterline whatever shape the band has. The
// picture is never stretched: the band is about four times wider than it is tall
// on a phone and eight times wider on a desktop screen.
//
// The sprites are fixed-size boxes in CSS percentages, not one stretched drawing,
// and they move through CSS alone (see style.css): each cloud crosses the whole
// sky and loops in the clipped strip outside it, so the restart is never seen.

export function SkyLayer() {
  return <div
    className="sea-sky"
    aria-hidden="true"
    style={{
      '--sky-photo': `url(${PHOTOS.sky})`,
      '--cloud-a': `url(${PHOTOS.cloudA})`,
      '--cloud-b': `url(${PHOTOS.cloudB})`,
      '--gull': `url(${PHOTOS.gull})`,
    }}
  >
    <Cloud variant="a" />
    <Cloud variant="b" />
    <Cloud variant="c" />
    <Gull variant="a" />
    <Gull variant="b" />
    <Gull variant="c" />
    <span className="sky-haze" />
  </div>;
}

// A cloud is its own photograph inside a box whose width sets how big it looks;
// the drift animation and the loop both belong to `.sea-cloud` in style.css.
export function Cloud({ variant = 'a' }) {
  return <span className={`sea-cloud cloud-${variant}`} />;
}

// A gull, the same way: the picture inside a small box that glides.
export function Gull({ variant = 'a' }) {
  return <span className={`sea-gull gull-${variant}`} />;
}
