import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EntityRecyclePool } from '../packages/ecs/src/entities/entity-recycle-pool';
import { decodeEntityBuffer, encodeEntityBuffer } from './serializers/entitySerializer';

describe('fitness: architecture guardrails', () => {
  it('REQ-ARCH-001: ECS core remains within the per-frame budget', () => {
    const pool = new EntityRecyclePool(1024);
    const start = performance.now();

    for (let index = 0; index < 200; index += 1) {
      const id = pool.acquire();
      if (id >= 0) {
        pool.release(id);
      }
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThanOrEqual(16.6);
    expect(pool.count()).toBeGreaterThan(0);
  });

  it('REQ-ARCH-002: core logic cannot reach into browser-only APIs', () => {
    const files = [
      new URL('../packages/ecs/src/index.ts', import.meta.url),
      new URL('../packages/shared-types/src/ecs.ts', import.meta.url),
    ];
    const sources = files.map((file) => readFileSync(file, 'utf8'));

    for (const source of sources) {
      expect(source).not.toMatch(/document|window|AudioContext|CanvasRenderingContext2D/);
    }
  });

  it('REQ-ARCH-003: entity state round-trips through ArrayBuffer boundary', () => {
    const snapshot = {
      id: 7,
      species: 3,
      x: 12.5,
      y: 9.25,
      vx: 1.5,
      vy: -0.75,
      energy: 42,
      size: 2.4,
      shape: 2,
      alive: 1,
    };

    const buffer = encodeEntityBuffer(snapshot);
    const decoded = decodeEntityBuffer(buffer);

    expect(decoded.id).toBe(snapshot.id);
    expect(decoded.species).toBe(snapshot.species);
    expect(decoded.x).toBe(snapshot.x);
    expect(decoded.y).toBe(snapshot.y);
    expect(decoded.vx).toBe(snapshot.vx);
    expect(decoded.vy).toBe(snapshot.vy);
    expect(decoded.energy).toBe(snapshot.energy);
    expect(decoded.size).toBeCloseTo(snapshot.size, 5);
    expect(decoded.shape).toBe(snapshot.shape);
    expect(decoded.alive).toBe(snapshot.alive);
  });
});
