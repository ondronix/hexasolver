export function shuffle(unshuffled) {
  return unshuffled
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

export function rotateVector(vec, rotTimes, stepAngle) {
  if (rotTimes === 0) return vec;
  const ang = rotTimes * stepAngle;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return [
    vec[0] * cos - vec[1] * sin,
    vec[0] * sin + vec[1] * cos
  ];
}

export const hasIntersection = (a1, a2) => a1.filter(value => a2.includes(value)).length > 0;