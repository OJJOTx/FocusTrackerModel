import { describe, it, expect } from 'vitest';
import { solvePnP } from '../src/attention/utils/pnp';

const model = Array.from({ length: 6 }, () => ({ x: 0, y: 0, z: 0 }));
const center = { x: 50, y: 50 };

function pointsForPitchRatio(ratio: number) {
  // Eyes are horizontal and 20 px apart. nose->chin is 20 px.
  // eyeCenter->nose distance controls the pitch ratio used by the heuristic.
  const eyeY = 40;
  const noseY = eyeY + ratio * 20;
  const chinY = noseY + 20;

  return [
    { x: 50, y: noseY }, // nose
    { x: 50, y: chinY }, // chin
    { x: 40, y: eyeY }, // left eye
    { x: 60, y: eyeY }, // right eye
    { x: 44, y: 62 }, // mouth left
    { x: 56, y: 62 }, // mouth right
  ];
}

describe('head pose pitch convention', () => {
  it('uses negative pitch for looking up', () => {
    const pose = solvePnP(pointsForPitchRatio(0.9), model, 100, center);
    expect(pose.pitch).toBeLessThan(0);
  });

  it('uses positive pitch for looking down', () => {
    const pose = solvePnP(pointsForPitchRatio(0.5), model, 100, center);
    expect(pose.pitch).toBeGreaterThan(0);
  });

  it('is near zero around the heuristic neutral ratio', () => {
    const pose = solvePnP(pointsForPitchRatio(0.7), model, 100, center);
    expect(Math.abs(pose.pitch)).toBeLessThan(0.001);
  });
});
