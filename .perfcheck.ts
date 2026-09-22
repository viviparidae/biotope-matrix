import { SimulationEngine } from './apps/worker/src/engine/simulation-engine';
import { Species } from './packages/shared-types/src/ecs';

const WARMUP_TICKS = 4;
const MEASURED_TICKS = 12;
const POPULATION_SIZES = [32, 64, 128];

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

for (const population of POPULATION_SIZES) {
  console.log('start population', population);
  const engine = createEngineWithPopulation(population);
  for (let tick = 0; tick < WARMUP_TICKS; tick += 1) {
    engine.tick();
  }
  const tickDurations: number[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  for (let tick = 0; tick < MEASURED_TICKS; tick += 1) {
    const startedAt = performance.now();
    engine.tick();
    tickDurations.push(performance.now() - startedAt);
  }
  const heapAfter = process.memoryUsage().heapUsed;
  const averageTickMs = tickDurations.reduce((total, duration) => total + duration, 0) / tickDurations.length;
  console.log(JSON.stringify({
    population,
    averageFps: 1000 / averageTickMs,
    p95TickMs: percentile(tickDurations, 0.95),
    heapGrowthPerTickBytes: (heapAfter - heapBefore) / MEASURED_TICKS,
  }));
}
