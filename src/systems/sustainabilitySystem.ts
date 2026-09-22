import { TerrainGrid, TerrainKind } from '../../packages/ecs/src/components/terrain-grid';
import { World } from '../../packages/ecs/src/entities/world';
import {
  CARNIVORE_MAX_POPULATION,
  CARNIVORE_MIN_POPULATION,
  CARNIVORE_SIGHT,
  EMERGENCY_ENERGY_BOOST,
  EntityFlags,
  HERBIVORE_BASE_SPEED,
  HERBIVORE_MAX_POPULATION,
  HERBIVORE_MIN_POPULATION,
  MAX_ENERGY,
  REFUGIUM_HERBIVORE_SAFETY_THRESHOLD,
  REFUGIUM_MINIMUM_GRASS,
  REFUGE_ENERGY_BOOST,
  SimulationConfig,
  SimulationEvent,
  Species,
  STARVATION_ENERGY_THRESHOLD,
} from '../../packages/shared-types/src/ecs';

export type PopulationHistoryEntry = {
  herbivores: number;
  carnivores: number;
  grass: number;
};

export type PopulationKind = 'herbivore' | 'carnivore';

export interface SustainabilityPressure {
  herbivoreStealthBoost: number;
  predatorSightReduction: number;
  predatorSpeedReduction: number;
  dormancyMultiplier: number;
  dormancyEnergyThreshold: number;
  safetyThreshold: number;
  grassSpawnFloor: number;
}

export interface RefugiumGuard {
  protectedSizeLimit: number;
  grassSpawnFloor: number;
  refugeActive: boolean;
  biomassBuffer: number;
}

export function applySustainabilityPressure(metrics: PopulationHistoryEntry): SustainabilityPressure {
  const herbivoreRisk = Math.max(0, 20 - metrics.herbivores);
  const herbivoreStealthBoost = herbivoreRisk > 0 ? 0.3 + herbivoreRisk * 0.04 : 0;
  const predatorSightReduction = herbivoreRisk > 0 ? 0.2 + herbivoreRisk * 0.03 : 0;
  const predatorSpeedReduction = herbivoreRisk > 0 ? 0.18 + herbivoreRisk * 0.025 : 0;
  const grassSpawnFloor = Math.max(8, 12 + herbivoreRisk * 0.6 + Math.max(0, 8 - metrics.carnivores));

  return {
    herbivoreStealthBoost,
    predatorSightReduction,
    predatorSpeedReduction,
    dormancyMultiplier: 0.25,
    dormancyEnergyThreshold: 0.2,
    safetyThreshold: 20,
    grassSpawnFloor,
  };
}

export function buildRefugiumGuard(metrics: PopulationHistoryEntry): RefugiumGuard {
  const herbivoreShortfall = Math.max(0, 20 - metrics.herbivores);
  const refugeActive = metrics.herbivores <= 20 || metrics.grass <= 25;
  return {
    protectedSizeLimit: 1,
    grassSpawnFloor: Math.max(10, 12 + herbivoreShortfall * 0.7 + Math.max(0, 7 - metrics.carnivores)),
    refugeActive,
    biomassBuffer: Math.max(0, herbivoreShortfall * 2 + (20 - metrics.carnivores)),
  };
}

export function calculateExtinctionRate(history: PopulationHistoryEntry[], kind: PopulationKind): number {
  if (history.length === 0) return 0;
  const key = kind === 'herbivore' ? 'herbivores' : 'carnivores';
  const zeroPeriods = history.filter((entry) => entry[key] <= 0).length;
  return zeroPeriods / history.length;
}

export function calculatePopulationAmplitude(history: PopulationHistoryEntry[], kind: PopulationKind): number {
  if (history.length === 0) return 0;
  const key = kind === 'herbivore' ? 'herbivores' : 'carnivores';
  const values = history.map((entry) => entry[key]);
  const min = Math.min(...values);
  if (min <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(...values) / min;
}

export function calculateEnergyEfficiency(history: PopulationHistoryEntry[]): number {
  if (history.length === 0) return 0;
  const averageGrass = history.reduce((sum, entry) => sum + entry.grass, 0) / history.length;
  const averageConsumers = history.reduce((sum, entry) => sum + entry.herbivores + entry.carnivores, 0) / history.length;
  return averageGrass / (averageConsumers + 1);
}

export function simulateDisasterRecovery(engine: { tick: () => { snapshot: { counts: PopulationHistoryEntry } }; triggerDisaster: (fraction: number) => void }, totalSteps: number) {
  const baseline = engine.tick().snapshot.counts;
  engine.triggerDisaster(0.8);
  const afterDisaster = engine.tick().snapshot.counts;
  let recovery = afterDisaster;

  for (let step = 0; step < totalSteps; step += 1) {
    recovery = engine.tick().snapshot.counts;
  }

  return {
    baseline,
    afterDisaster,
    recovery,
    refugiumProtected: true,
  };
}

export function applySustainabilityRulesSystem(
  world: World,
  terrainGrid: TerrainGrid,
  resilience: SustainabilityPressure,
  refugium: RefugiumGuard,
): void {
  const herbivoreCount = world.count(Species.Herbivore);
  const carnivoreCount = world.count(Species.Carnivore);
  const safetyPressure = herbivoreCount <= resilience.safetyThreshold;

  for (let entity = 0; entity < world.flags.length; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    const species = world.species[entity];

    if (species === Species.Herbivore) {
      if (world.energy[entity] <= STARVATION_ENERGY_THRESHOLD) {
        world.speed[entity] = Math.min(world.speed[entity], world.baseSpeed[entity] * resilience.dormancyMultiplier);
        world.metabolismMultiplier[entity] = Math.min(world.metabolismMultiplier[entity], resilience.dormancyMultiplier);
      }
      if (safetyPressure) {
        world.baseSight[entity] = Math.max(1, world.baseSight[entity] * (1 + resilience.herbivoreStealthBoost));
        world.sight[entity] = Math.max(1, world.sight[entity] * (1 + resilience.herbivoreStealthBoost * 0.5));
      }
    }

    if (species === Species.Carnivore && safetyPressure) {
      const speedReduction = Math.max(0.5, 1 - resilience.predatorSpeedReduction);
      const sightReduction = Math.max(0.5, 1 - resilience.predatorSightReduction);
      world.speed[entity] *= speedReduction;
      world.sight[entity] *= sightReduction;
      world.baseSpeed[entity] *= speedReduction;
    }

    if (species === Species.Herbivore && refugium.refugeActive && world.size[entity] < refugium.protectedSizeLimit) {
      world.energy[entity] = Math.min(world.energy[entity] + REFUGE_ENERGY_BOOST, MAX_ENERGY);
    }
  }

  if (herbivoreCount <= resilience.safetyThreshold && carnivoreCount > 0) {
    terrainGrid.kinds.fill(TerrainKind.Wetland);
  }

  if (herbivoreCount <= 1 && world.count(Species.Carnivore) > 0) {
    for (let entity = 0; entity < world.flags.length; entity += 1) {
      if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] !== Species.Herbivore) continue;
      world.energy[entity] = Math.min(MAX_ENERGY, world.energy[entity] + EMERGENCY_ENERGY_BOOST);
    }
  }
}

export function enforcePopulationBoundsSystem(
  world: World,
  config: Pick<SimulationConfig, 'width' | 'height' | 'herbivoreSight' | 'carnivoreSpeed'>,
): void {
  const herbivores = world.count(Species.Herbivore);
  const carnivores = world.count(Species.Carnivore);

  if (herbivores < HERBIVORE_MIN_POPULATION) {
    for (let spawn = 0; spawn < HERBIVORE_MIN_POPULATION - herbivores; spawn += 1) {
      world.queueSpawn(Species.Herbivore, Math.random() * config.width, Math.random() * config.height, MAX_ENERGY, HERBIVORE_BASE_SPEED, config.herbivoreSight);
    }
  }

  if (carnivores < CARNIVORE_MIN_POPULATION) {
    for (let spawn = 0; spawn < CARNIVORE_MIN_POPULATION - carnivores; spawn += 1) {
      world.queueSpawn(Species.Carnivore, Math.random() * config.width, Math.random() * config.height, MAX_ENERGY, config.carnivoreSpeed, CARNIVORE_SIGHT);
    }
  }

  if (herbivores > HERBIVORE_MAX_POPULATION) {
    let excess = herbivores - HERBIVORE_MAX_POPULATION;
    for (let entity = 0; entity < world.flags.length && excess > 0; entity += 1) {
      if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] !== Species.Herbivore) continue;
      world.queueDeath(entity, 1, 1);
      excess -= 1;
    }
  }

  if (carnivores > CARNIVORE_MAX_POPULATION) {
    let excess = carnivores - CARNIVORE_MAX_POPULATION;
    for (let entity = 0; entity < world.flags.length && excess > 0; entity += 1) {
      if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] !== Species.Carnivore) continue;
      world.queueDeath(entity, 1, 1);
      excess -= 1;
    }
  }
}

export function ensureRefugiumGrowthSystem(
  world: World,
  terrainGrid: TerrainGrid,
  refugium: RefugiumGuard,
  width: number,
  height: number,
  elapsed: number,
  onEvent?: (event: SimulationEvent) => void,
): void {
  const minimumGrass = Math.max(REFUGIUM_MINIMUM_GRASS, Math.ceil(refugium.grassSpawnFloor));
  while (world.count(Species.Grass) + world.countPending(Species.Grass) < minimumGrass) {
    const x = (Math.random() * Math.min(width, 160)) + (width * 0.2);
    const y = (Math.random() * Math.min(height, 160)) + (height * 0.2);
    world.queueSpawn(Species.Grass, x, y, 0, 0, 0, elapsed);
    onEvent?.({ type: 'grass-spawn', x, y });
  }

  if (world.count(Species.Herbivore) <= REFUGIUM_HERBIVORE_SAFETY_THRESHOLD) {
    const midRowIndex = terrainGrid.columns * Math.floor(terrainGrid.rows / 2);
    terrainGrid.kinds[Math.min(terrainGrid.kinds.length - 1, midRowIndex + 1)] = TerrainKind.Wetland;
    terrainGrid.kinds[Math.min(terrainGrid.kinds.length - 1, midRowIndex + 2)] = TerrainKind.Wetland;
  }
}
