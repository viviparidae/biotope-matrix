import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../apps/worker/src/engine/simulation-engine';
import { FIXED_STEP, Species } from '../../packages/shared-types/src/ecs';

const WARMUP_TICKS = 30;
const MEASURED_TICKS = 120;
const FRAME_TIME_BUDGET_MS = 33;
const MINIMUM_AVERAGE_FPS = 30;
const POPULATION_SIZES = [128, 256, 512];

interface PerformanceMeasurement {
  population: number;
  averageFps: number;
  p95TickMs: number;
  heapGrowthPerTickBytes: number;
}

function useDeterministicRandom(): void {
  let randomState = 123456789;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    randomState = (randomState * 1664525 + 1013904223) % 4294967296;
    return randomState / 4294967296;
  });
}

function createEngineWithPopulation(population: number): SimulationEngine {
  const engine = new SimulationEngine(`performance-${population}`, 960, 540);
  engine.apply({ type: 'reset' });
  engine.apply({ type: 'spawn', species: Species.Herbivore, count: population });
  return engine;
}

function percentile(values: number[], rank: number): number {
  const sortedValues = [...values].sort((left, right) => left - right);
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * rank) - 1);
  return sortedValues[index];
}

function measurePopulation(population: number): PerformanceMeasurement {
  const engine = createEngineWithPopulation(population);
  for (let tick = 0; tick < WARMUP_TICKS; tick += 1) engine.tick();

  const tickDurations: number[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  for (let tick = 0; tick < MEASURED_TICKS; tick += 1) {
    const startedAt = performance.now();
    engine.tick();
    tickDurations.push(performance.now() - startedAt);
  }
  const heapAfter = process.memoryUsage().heapUsed;
  const averageTickMs = tickDurations.reduce((total, duration) => total + duration, 0) / tickDurations.length;

  return {
    population,
    averageFps: 1000 / averageTickMs,
    p95TickMs: percentile(tickDurations, 0.95),
    heapGrowthPerTickBytes: (heapAfter - heapBefore) / MEASURED_TICKS,
  };
}

describe('シミュレーション性能', () => {
  afterEach(() => vi.restoreAllMocks());

  it('NFR-01: 個体数が増えても平均30 FPS以上かつ更新95パーセンタイル33ms以下で進行する', () => {
    // Arrange
    useDeterministicRandom();

    // Act
    const measurements = POPULATION_SIZES.map(measurePopulation);
    console.info('NFR-01 performance', JSON.stringify(measurements));

    // Assert
    for (const measurement of measurements) {
      expect(measurement.averageFps, `population=${measurement.population}`).toBeGreaterThanOrEqual(MINIMUM_AVERAGE_FPS);
      expect(measurement.p95TickMs, `population=${measurement.population}`).toBeLessThanOrEqual(FRAME_TIME_BUDGET_MS);
      expect(Number.isFinite(measurement.heapGrowthPerTickBytes)).toBe(true);
    }
  });

  it('NFR-01: 固定tickは1秒あたり60回のシミュレーション時間を表す', () => {
    // Arrange
    const expectedTicksPerSecond = 60;

    // Act
    const ticksPerSecond = 1 / FIXED_STEP;

    // Assert
    expect(ticksPerSecond).toBe(expectedTicksPerSecond);
  });
});