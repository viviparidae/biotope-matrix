import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../apps/worker/src/engine/simulation-engine';
import { TerrainGrid } from '../../packages/ecs/src/components/terrain-grid';
import { World } from '../../packages/ecs/src/entities/world';
import { ensureRefugiumGrowthSystem } from '../../src/systems/sustainabilitySystem';
import type { SimulationCommand } from '../../packages/shared-types/src/api';
import { Species } from '../../packages/shared-types/src/ecs';

type AdjustableConfigKey = Extract<SimulationCommand, { type: 'update-config' }>['key'];

describe('シミュレーション設定の変更', () => {
  it('NFR-03: 観察向けの初期値では60秒後も生態系の個体が残る', () => {
    // Arrange
    let randomState = 123456789;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randomState = (randomState * 1664525 + 1013904223) % 4294967296;
      return randomState / 4294967296;
    });
    const engine = new SimulationEngine('observation-defaults', 960, 540);

    // Act
    let snapshot = engine.tick().snapshot;
    for (let tick = 1; tick < 60 * 60; tick += 1) snapshot = engine.tick().snapshot;
    vi.restoreAllMocks();

    // Assert
    expect(snapshot.counts.grass).toBeGreaterThan(0);
    expect(snapshot.counts.herbivores).toBeGreaterThan(0);
    expect(snapshot.counts.carnivores).toBeGreaterThan(0);
  });

  it('NFR-03/NFR-09: 設定の境界値 N-1, N, N+1 で正規化されて維持される', () => {
    // Arrange
    const engine = new SimulationEngine('tuning-boundaries', 240, 240);
    const boundaryCases: Array<[AdjustableConfigKey, number, number, number]> = [
      ['grassSpawnInterval', 0.09, 0.1, 0.11],
      ['maxGrass', 9, 10, 11],
      ['herbivoreSight', 0, 1, 2],
      ['splitEnergy', 49, 50, 51],
      ['carnivoreSpeed', 0, 1, 2],
      ['carnivoreMetabolism', 0.09, 0.1, 0.11],
    ];

    // Act
    for (const [key, lower, boundary, upper] of boundaryCases) {
      engine.apply({ type: 'update-config', key, value: lower });
      engine.tick();
      expect(engine.tick().snapshot.config[key]).toBeGreaterThanOrEqual(boundary);
      engine.apply({ type: 'update-config', key, value: boundary });
      engine.tick();
      expect(engine.tick().snapshot.config[key]).toBe(boundary);
      engine.apply({ type: 'update-config', key, value: upper });
      engine.tick();
      expect(engine.tick().snapshot.config[key]).toBeGreaterThanOrEqual(boundary);
    }

    // Assert
    expect(engine.tick().snapshot.sequence).toBeGreaterThan(0);
  });

  it('NFR-03/NFR-09: 複数の設定を連続変更しても次の tick が有限値で進行する', () => {
    // Arrange
    const engine = new SimulationEngine('tuning-stress', 240, 240);
    const keys: AdjustableConfigKey[] = [
      'grassSpawnInterval',
      'maxGrass',
      'herbivoreSight',
      'splitEnergy',
      'carnivoreSpeed',
      'carnivoreMetabolism',
    ];
    const values = [0.1, 300, 1, 300, 60, 10, 0, -100, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    const initialSequence = engine.tick().snapshot.sequence;

    // Act
    for (let iteration = 0; iteration < 20; iteration += 1) {
      for (let index = 0; index < keys.length; index += 1) {
        engine.apply({ type: 'update-config', key: keys[index], value: values[(iteration + index) % values.length] });
      }
      engine.tick();
    }
    const result = engine.tick();

    // Assert
    expect(result.snapshot.sequence).toBeGreaterThan(initialSequence);
    expect(result.snapshot.entities.x.every(Number.isFinite)).toBe(true);
    expect(result.snapshot.entities.y.every(Number.isFinite)).toBe(true);
    expect(Object.values(result.snapshot.config).every((value) => typeof value !== 'number' || Number.isFinite(value))).toBe(true);
    expect(result.snapshot.config.grassSpawnInterval).toBeGreaterThanOrEqual(0.1);
    expect(result.snapshot.config.grassSpawnInterval).toBeLessThanOrEqual(5);
    expect(result.snapshot.config.maxGrass).toBeGreaterThanOrEqual(10);
    expect(result.snapshot.config.maxGrass).toBeLessThanOrEqual(300);
    expect(result.snapshot.config.herbivoreSight).toBeGreaterThanOrEqual(1);
    expect(result.snapshot.config.herbivoreSight).toBeLessThanOrEqual(150);
    expect(result.snapshot.config.splitEnergy).toBeGreaterThanOrEqual(50);
    expect(result.snapshot.config.splitEnergy).toBeLessThanOrEqual(300);
    expect(result.snapshot.config.carnivoreSpeed).toBeGreaterThanOrEqual(1);
    expect(result.snapshot.config.carnivoreSpeed).toBeLessThanOrEqual(60);
    expect(result.snapshot.config.carnivoreMetabolism).toBeGreaterThanOrEqual(0.1);
    expect(result.snapshot.config.carnivoreMetabolism).toBeLessThanOrEqual(10);
  });

  it('NFR-03: refugium growth counts queued grass spawns so the loop terminates', () => {
    const world = new World();
    const terrain = new TerrainGrid(240, 240);

    ensureRefugiumGrowthSystem(world, terrain, {
      protectedSizeLimit: 1,
      grassSpawnFloor: 80,
      refugeActive: true,
      biomassBuffer: 0,
    }, 240, 240, 0);

    world.commitCommands();

    expect(world.count(Species.Grass)).toBeGreaterThanOrEqual(80);
  });

  it('REQ-UI-002: reset clears the world and remains stable until a new spawn command is issued', () => {
    const engine = new SimulationEngine('reset-hold', 240, 240);

    engine.apply({ type: 'reset' });
    expect(engine.tick().snapshot.counts).toEqual({ grass: 0, herbivores: 0, carnivores: 0 });

    engine.apply({ type: 'spawn', species: Species.Herbivore, count: 10 });
    const afterSpawn = engine.tick().snapshot.counts;

    expect(afterSpawn.herbivores).toBeGreaterThanOrEqual(10);
    expect(afterSpawn.grass).toBeGreaterThanOrEqual(0);
  });
});