import { describe, it, expect } from 'vitest';
import {
  distance2D,
  distance3D,
  degreesToRadians,
  radiansToDegrees,
  clamp,
  lerp,
  normalize,
  dotProduct,
  crossProduct,
  vectorLength,
  normalizeVector,
} from '../src/attention/utils/math';

describe('math utilities', () => {
  describe('distance2D', () => {
    it('returns 0 for same point', () => {
      expect(distance2D({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    });

    it('computes known distance', () => {
      expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it('works with negative coords', () => {
      expect(distance2D({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5);
    });
  });

  describe('distance3D', () => {
    it('returns 0 for same point', () => {
      expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(0);
    });

    it('computes known distance', () => {
      expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBe(3);
    });
  });

  describe('degreesToRadians / radiansToDegrees', () => {
    it('converts 0 degrees', () => {
      expect(degreesToRadians(0)).toBe(0);
    });

    it('converts 180 degrees', () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    });

    it('converts 90 degrees', () => {
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
    });

    it('round-trips correctly', () => {
      expect(radiansToDegrees(degreesToRadians(45))).toBeCloseTo(45);
      expect(radiansToDegrees(degreesToRadians(360))).toBeCloseTo(360);
    });
  });

  describe('clamp', () => {
    it('returns value when in range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps to max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('returns a at t=0', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it('returns b at t=1', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('returns midpoint at t=0.5', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
    });
  });

  describe('normalize', () => {
    it('returns 0 for value at min', () => {
      expect(normalize(0, 0, 10)).toBe(0);
    });

    it('returns 1 for value at max', () => {
      expect(normalize(10, 0, 10)).toBe(1);
    });

    it('returns 0.5 at midpoint', () => {
      expect(normalize(5, 0, 10)).toBe(0.5);
    });

    it('returns 0 when min equals max', () => {
      expect(normalize(5, 5, 5)).toBe(0);
    });
  });

  describe('dotProduct', () => {
    it('computes correctly', () => {
      const a = { x: 1, y: 2, z: 3 };
      const b = { x: 4, y: 5, z: 6 };
      expect(dotProduct(a, b)).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it('returns 0 for perpendicular vectors', () => {
      expect(dotProduct({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0);
    });
  });

  describe('crossProduct', () => {
    it('computes i x j = k', () => {
      const result = crossProduct({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      expect(result).toEqual({ x: 0, y: 0, z: 1 });
    });
  });

  describe('vectorLength', () => {
    it('returns 0 for zero vector', () => {
      expect(vectorLength({ x: 0, y: 0, z: 0 })).toBe(0);
    });

    it('returns correct magnitude', () => {
      expect(vectorLength({ x: 1, y: 2, z: 2 })).toBe(3);
    });
  });

  describe('normalizeVector', () => {
    it('returns unit vector', () => {
      const result = normalizeVector({ x: 3, y: 0, z: 0 });
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });

    it('returns zero for zero vector', () => {
      const result = normalizeVector({ x: 0, y: 0, z: 0 });
      expect(result).toEqual({ x: 0, y: 0, z: 0 });
    });
  });
});
