// Pure helpers for the number line itself: turning taps into values and
// deciding whether a landing needs the gentle "let's land exactly here"
// adjustment hop. Kept free of React so tests cover them directly.

export const LINE_MIN = 0;
export const LINE_MAX = 100;

// A child's tap lands near the intended tick, not exactly on it, so a couple
// of units of grace counts as landing right on the answer.
export const LANDING_TOLERANCE = 2;

export function clampToLine(value) {
  return Math.min(LINE_MAX, Math.max(LINE_MIN, value));
}

// Turns a tap position (pixels from the strip's left edge) into the value it
// points at on the 0–100 line. A zero or missing width (hidden element,
// jsdom) falls back to the middle of the line rather than crashing.
export function tapToValue(offsetFromLeft, stripWidth) {
  if (!stripWidth || stripWidth <= 0) return Math.round((LINE_MIN + LINE_MAX) / 2);
  const raw = (offsetFromLeft / stripWidth) * (LINE_MAX - LINE_MIN) + LINE_MIN;
  return Math.round(clampToLine(raw));
}

// True when the frog should do its small extra hop from the tapped spot to
// where the answer actually lives. Within tolerance the first landing is
// already treated as exact – no adjustment, straight to the celebration.
export function needsAdjust(tappedValue, answer) {
  return Math.abs(tappedValue - answer) > LANDING_TOLERANCE;
}
