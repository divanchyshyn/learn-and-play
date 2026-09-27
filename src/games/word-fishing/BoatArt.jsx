import { PHOTOS } from './photos.js';
import { PhotoSprite } from './PhotoSprite.jsx';

// The boat: a photograph of a real fishing boat, with the angler standing in her
// bow and the gear the child needs drawn on top of the picture.
//
// Everything lives in the boat's own box, the very box the rig is measured in (see
// RIG_DX and RIG_Y in rig.js). The hull is a photograph, so its own waterline is
// whatever the picture's lower edge is: the photo is anchored so that edge lands
// on the box's waterline, which is the same line the sea's surface runs along. The
// angler is a second photograph, placed so his hands sit on the rod's grip – the
// anchor the line layer starts from – with his boots on the photograph's deck.
//
// Two things are still drawn rather than photographed, because a child reads them:
// the flag with the day's trip number and the counter board on the hull. Both keep
// the coordinates the drawn boat used, so the day's catch sails with the boat
// instead of taking up room on the water.
//
// The whole assembly carries `.boat-drawing`, so the hull still leans into its
// heading when it is under way (see style.css).
export function BoatArt({ tripNumber, tripProgress }) {
  return <div className="boat-drawing">
    <PhotoSprite className="boat-photo" photo={PHOTOS.boat} />
    <PhotoSprite className="angler-photo" photo={PHOTOS.angler} />

    <svg className="boat-signs" viewBox="0 0 220 190" aria-hidden="true" focusable="false">
      <path className="boat-flag" d="M152 14 Q 178 18 203 24 Q 189 32 203 42 Q 178 46 152 42 Z" fill="#d24d31" />
      <path className="boat-flag-fold" d="M152 28 Q 178 32 203 34 L203 42 Q 178 46 152 42 Z" fill="#b8412a" opacity=".35" />
      <text className="boat-flag-number" x="176" y="34" textAnchor="middle">{tripNumber}</text>

      <path className="boat-trip-board" d="M40 129 L126 133 L126 148 L40 144 Z" fill="#6f4b22" />
      <text className="boat-trip-progress" x="83" y="143.5" textAnchor="middle">{tripProgress}</text>
    </svg>
  </div>;
}
