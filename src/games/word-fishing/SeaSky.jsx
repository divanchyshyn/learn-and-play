import { paint } from './SeaArtDefs.jsx';

// The sky above the waterline: a low sun with its corona and lens glow, fractal
// clouds drifting across it, gulls, and a far shore dissolving into the horizon
// haze.
//
// Everything here is a fixed-size sprite positioned in CSS percentages, not one
// stretched drawing, because the sky band is about four times wider than it is
// tall on a phone and eight times wider on a desktop screen: a single drawing
// would either squash the sun or crop the shore away on one of them. The band's
// own colour gradient is CSS, so it simply fills whatever the sea box is.
//
// A cloud is not drawn shape by shape any more: the shared `wf-cloud-puff`
// filter turns fractal noise into a soft, lumpy puff with a shaded base and a lit
// top, so no two look alike. The noise is generated once, when the cloud is
// painted, and the drift stays a CSS animation, so a tablet never re-renders it.

export function Cloud({ variant = 'a' }) {
  return <svg className={`sea-cloud cloud-${variant}`} viewBox="0 0 220 96" aria-hidden="true" focusable="false">
    <rect className="cloud-puff" x="6" y="22" width="208" height="62" rx="30" />
  </svg>;
}

// A gull is two curves and a hint of a body – enough to read at any size.
export function Gull({ variant = 'a' }) {
  return <svg className={`sea-gull gull-${variant}`} viewBox="0 0 46 20" aria-hidden="true" focusable="false">
    <path className="gull-wing" d="M2 15 Q 12 2 23 12 Q 34 2 44 15" />
    <path className="gull-body" d="M19 12 Q 23 8 27 12 Q 23 15 19 12 Z" />
  </svg>;
}

// A far shore, pale and soft on purpose: it is the horizon, not a place to look
// at. The buildings lose their edges in the same haze the water does.
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
    <span className="sea-sun-flare" />
    <span className="sea-sun" />
    <Cloud variant="a" />
    <Cloud variant="b" />
    <Cloud variant="c" />
    <Gull variant="a" />
    <Gull variant="b" />
    <Gull variant="c" />
    <DistantShore />
    <span className="sea-haze" />
  </div>;
}
