import { PHOTOS } from './photos.js';
import { PhotoSprite } from './PhotoSprite.jsx';

// The boat: a photograph of a real fishing boat, with the angler standing in her
// bow and the gear the child needs drawn on top of the picture.
//
// The hull and the angler both live inside `.boat-hull`, the frame of the hull
// picture itself: a box in that photograph's own proportions (900 x 553, see
// style.css), so the picture is never stretched and nothing on the boat can drift
// across her as the sea changes shape.
//
// Her waterline is a row *inside* the picture rather than her lower edge: her paint
// ends along row 88 of 100 and the water she sits in fills the rows below it. The
// frame is therefore anchored by that row - `--hull-waterline` and the `--hull-dip`
// that follows from it (style.css) - so row 88 rests on the sea's own surface and
// the picture's water hangs below it, which is what floats her instead of leaving
// her hovering over the surface.
//
// The angler is a second photograph, placed in frame percentages so his boots stay
// on the foredeck whatever the sea's size. His hands are where the rod is gripped:
// the rig anchors the line layer draws from (RIG_DX.rodBase, RIG_Y.rodBase in
// rig.js) are shares of the sea box, measured off the boat's left edge - the sea
// box being what a child sails her around in, not the picture's frame - so on a sea
// whose proportions differ a lot from the ones they were tuned on, the rod's grip
// can sit a little off his hands. Measuring the rig in the frame instead would fix
// that; that is a change to the rig itself, not to where he stands.
//
// Two things are still drawn rather than photographed, because a child reads them:
// the flag with the day's trip number and the counter board on the hull. Both keep
// the coordinates the drawn boat used - they are not part of the picture - and both
// sink by the same `--hull-dip` the hull does, so the day's catch keeps the place it
// has on her paint and sails with her instead of taking up room on the water.
//
// The whole assembly carries `.boat-drawing`, so the hull still leans into its
// heading when it is under way (see style.css).
export function BoatArt({ tripNumber, tripProgress }) {
  return <div className="boat-drawing">
    <div className="boat-hull">
      <PhotoSprite className="boat-photo" photo={PHOTOS.boat} />
      <PhotoSprite className="angler-photo" photo={PHOTOS.angler} />
    </div>

    <svg className="boat-signs" viewBox="0 0 220 190" aria-hidden="true" focusable="false">
      <path className="boat-flag" d="M152 14 Q 178 18 203 24 Q 189 32 203 42 Q 178 46 152 42 Z" fill="#d24d31" />
      <path className="boat-flag-fold" d="M152 28 Q 178 32 203 34 L203 42 Q 178 46 152 42 Z" fill="#b8412a" opacity=".35" />
      <text className="boat-flag-number" x="176" y="34" textAnchor="middle">{tripNumber}</text>

      <path className="boat-trip-board" d="M40 129 L126 133 L126 148 L40 144 Z" fill="#6f4b22" />
      <text className="boat-trip-progress" x="83" y="143.5" textAnchor="middle">{tripProgress}</text>
    </svg>
  </div>;
}

