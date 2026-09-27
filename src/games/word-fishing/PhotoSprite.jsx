// One photograph on the stage.
//
// Everything photographic in the game goes through here, so the rules live in one
// place: a sprite is decorative (silent to a screen reader, never dragged, never
// selected), and it is pasted at its own proportions by CSS – a photograph is
// never stretched to fit a box, the box is what changes. `decoding="async"` keeps
// a big picture from blocking the frame it arrives in.
export function PhotoSprite({ photo, className, style }) {
  return <img
    className={className}
    src={photo}
    alt=""
    aria-hidden="true"
    draggable="false"
    decoding="async"
    style={style}
  />;
}
