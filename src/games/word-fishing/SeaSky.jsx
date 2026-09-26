import { paint } from './SeaArtDefs.jsx';

// The sky above the waterline: a sun with a corona, layered clouds, gulls, and a
// hazy shore with a lighthouse on the horizon.
//
// Everything here is a fixed-size sprite positioned in CSS percentages, not one
// stretched drawing, because the sky band is about four times wider than it is
// tall on a phone and eight times wider on a desktop screen: a single drawing
// would either squash the sun or crop the shore away on one of them. The band's
// own colour gradient is CSS, so it simply fills whatever the sea box is.

export function Cloud({ variant = 'a' }) {
  return <svg className={`sea-cloud cloud-${variant}`} viewBox="0 0 140 66" aria-hidden="true" focusable="false">
    <ellipse cx="70" cy="46" rx="62" ry="17" fill={paint('cloud')} />
    <ellipse cx="44" cy="34" rx="29" ry="21" fill={paint('cloud')} />
    <ellipse cx="82" cy="27" rx="33" ry="25" fill={paint('cloud')} />
    <ellipse cx="106" cy="40" rx="23" ry="15" fill={paint('cloud')} />
    <path
      className="cloud-shade"
      d="M8 46 Q 40 60 72 52 Q 104 60 134 44 Q 122 62 70 62 Q 22 62 8 46 Z"
      fill={paint('cloud-shade')}
    />
    <path className="cloud-light" d="M66 6 Q 92 4 104 18 Q 86 10 66 12 Z" fill="#ffffff" opacity=".75" />
  </svg>;
}

// A gull is two curves and a hint of a body – enough to read at any size.
export function Gull({ variant = 'a' }) {
  return <svg className={`sea-gull gull-${variant}`} viewBox="0 0 46 20" aria-hidden="true" focusable="false">
    <path className="gull-wing" d="M2 15 Q 12 2 23 12 Q 34 2 44 15" />
    <path className="gull-body" d="M19 12 Q 23 8 27 12 Q 23 15 19 12 Z" />
  </svg>;
}

// A far shore, kept pale on purpose: it is the horizon, not a place to look at.
export function DistantShore() {
  return <svg className="sea-shore" viewBox="0 0 240 72" aria-hidden="true" focusable="false">
    <path d="M0 70 Q 42 42 78 50 Q 108 56 132 70 Z" fill={paint('island-far')} opacity=".72" />
    <path d="M92 70 Q 146 24 186 42 Q 214 54 240 70 Z" fill={paint('island')} opacity=".9" />
    <path className="shore-rock" d="M150 70 Q 160 56 172 68 Z" fill={paint('rock-dark')} opacity=".55" />
    {/* The lighthouse: a tapered tower with its lamp still turning. */}
    <path className="shore-tower" d="M196 20 L208 20 L211 42 L193 42 Z" fill={paint('lighthouse')} />
    <path className="shore-door" d="M198 42 L206 42 L206 34 L198 34 Z" fill={paint('rock-dark')} opacity=".7" />
    <rect className="shore-lamp" x="198" y="14" width="8" height="7" rx="1.5" fill={paint('lantern-glass')} />
    <path className="shore-cap" d="M197 14 L207 14 L202 8 Z" fill={paint('rust')} />
    <circle className="shore-beam" cx="202" cy="17" r="9" fill={paint('station-light')} opacity=".55" />
  </svg>;
}

export function SkyLayer() {
  return <div className="sea-sky" aria-hidden="true">
    <span className="sea-sun-glow" />
    <span className="sea-sun" />
    <Cloud variant="a" />
    <Cloud variant="b" />
    <Cloud variant="c" />
    <Gull variant="a" />
    <Gull variant="b" />
    <Gull variant="c" />
    <DistantShore />
  </div>;
}
