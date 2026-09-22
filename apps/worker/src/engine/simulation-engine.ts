import { NutrientGrid } from '../../../../packages/ecs/src/components/nutrient-grid';
import { TerrainGrid } from '../../../../packages/ecs/src/components/terrain-grid';
import { World } from '../../../../packages/ecs/src/entities/world';
import { behaviorSystem, decompositionSystem, disasterSystem, environmentSystem, interactionSystem, lifecycleSystem, movementSystem, seedWorld, spawnNutrientGrass, terrainSystem } from '../../../../packages/ecs/src/systems/simulation-systems';
import { CARNIVORE_SIGHT, EntityFlags, FIXED_STEP, HERBIVORE_BASE_SPEED, MAX_ENERGY, SimulationCommand, SimulationConfig, SimulationEvent, SimulationSnapshot, Species } from '../../../../packages/shared-types/src';
import { applySustainabilityPressure, applySustainabilityRulesSystem, buildRefugiumGuard, enforcePopulationBoundsSystem, ensureRefugiumGrowthSystem } from '../../../../src/systems/sustainabilitySystem';
import type { DisasterState } from '../../../../packages/ecs/src/systems/simulation-systems';

const CONFIGURATION_LIMITS = {
  grassSpawnInterval: { minimum: 0.1, maximum: 5 },
  maxGrass: { minimum: 10, maximum: 2000 },
  herbivoreSight: { minimum: 1, maximum: 150 },
  splitEnergy: { minimum: 50, maximum: 300 },
  carnivoreSpeed: { minimum: 1, maximum: 60 },
  carnivoreMetabolism: { minimum: 0.1, maximum: 10 },
} as const;

type AdjustableConfigKey = keyof typeof CONFIGURATION_LIMITS;

function normalizeConfigurationValue(key: AdjustableConfigKey, value: number, currentValue: number): number {
  if (!Number.isFinite(value)) return currentValue;
  const limits = CONFIGURATION_LIMITS[key];
  return Math.max(limits.minimum, Math.min(limits.maximum, value));
}

export class SimulationEngine {
  private readonly world = new World();
  private readonly nutrientGrid: NutrientGrid;
  private readonly terrainGrid: TerrainGrid;
  private readonly disasterState: DisasterState = { breedingRemaining: 0, meteorTriggered: false, floodTriggered: false };
  private elapsed = 0;
  private sequence = 0;
  private holdAfterReset = false;
  private suspendAutoBalance = false;
  private readonly config: SimulationConfig;

  constructor(private readonly simulationId: string, width: number, height: number) {
    this.config = { width, height, initialGrass: 700, initialHerbivores: 180, initialCarnivores: 20, grassSpawnInterval: 0.5, maxGrass: 900, herbivoreSight: 12, splitEnergy: 180, carnivoreSpeed: 16, carnivoreMetabolism: 1.8 };
    this.nutrientGrid = new NutrientGrid(width, height);
    this.terrainGrid = new TerrainGrid(width, height);
    seedWorld(this.world, this.config);
  }

  tick(): { snapshot: SimulationSnapshot; events: SimulationEvent[] } {
    if (this.holdAfterReset) {
      return { snapshot: this.snapshot(), events: [] };
    }

    const events: SimulationEvent[] = [];
    const emit = (event: SimulationEvent): void => { events.push(event); };
    const wetlandMultiplier = this.terrainGrid.wetlandArea() > 0 ? 10 : 1;
    const breedingMultiplier = this.disasterState.breedingRemaining > 0 ? 10 : 1;
    const tickConfig = { ...this.config, grassSpawnInterval: this.config.grassSpawnInterval / wetlandMultiplier / breedingMultiplier };
    const currentCounts = { grass: this.world.count(Species.Grass), herbivores: this.world.count(Species.Herbivore), carnivores: this.world.count(Species.Carnivore) };
    const resilience = applySustainabilityPressure(currentCounts);
    const refugium = buildRefugiumGuard(currentCounts);

    ensureRefugiumGrowthSystem(this.world, this.terrainGrid, refugium, this.config.width, this.config.height, this.elapsed, emit);
    spawnNutrientGrass(this.world, this.nutrientGrid, this.terrainGrid, this.elapsed, tickConfig, emit);
    behaviorSystem(this.world, this.terrainGrid, this.config);
    applySustainabilityRulesSystem(this.world, this.terrainGrid, resilience, refugium);
    if (!this.suspendAutoBalance) enforcePopulationBoundsSystem(this.world, this.config);
    environmentSystem(this.world, this.config.brightness ?? 1, this.config.temperature ?? 20);
    movementSystem(this.world, this.terrainGrid, FIXED_STEP, this.config.width, this.config.height);
    interactionSystem(this.world, this.terrainGrid, this.config, emit);
    lifecycleSystem(this.world, this.elapsed, FIXED_STEP, this.config);
    decompositionSystem(this.world, this.nutrientGrid, this.terrainGrid, FIXED_STEP);
    terrainSystem(this.terrainGrid, emit);
    disasterSystem(this.world, this.terrainGrid, this.disasterState, this.config.width, this.config.height, this.config, emit);
    this.terrainGrid.advanceFlood(FIXED_STEP, this.config.height);
    this.world.commitCommands();
    this.elapsed += FIXED_STEP;
    this.sequence += 1;
    return { snapshot: this.snapshot(), events };
  }

  triggerDisaster(fraction = 0.8): void {
    const herbivores = this.world.count(Species.Herbivore);
    const carnivores = this.world.count(Species.Carnivore);
    let herbivoreTargets = Math.max(0, Math.ceil(herbivores * fraction));
    let carnivoreTargets = Math.max(0, Math.ceil(carnivores * fraction));

    for (let entity = 0; entity < this.world.flags.length; entity += 1) {
      if ((this.world.flags[entity] & EntityFlags.Alive) === 0) continue;
      const species = this.world.species[entity];
      if (species === Species.Herbivore && herbivoreTargets > 0) {
        this.world.queueDeath(entity, 1, 1);
        herbivoreTargets -= 1;
      } else if (species === Species.Carnivore && carnivoreTargets > 0) {
        this.world.queueDeath(entity, 1, 1);
        carnivoreTargets -= 1;
      }
    }
    this.world.commitCommands();
    for (let index = 0; index < Math.max(8, Math.ceil(20 * (1 - fraction))); index += 1) {
      const x = Math.random() * this.config.width;
      const y = Math.random() * this.config.height;
      this.world.queueSpawn(Species.Grass, x, y, 0, 0, 0, this.elapsed);
    }
    this.world.commitCommands();
  }

  apply(command: SimulationCommand): void {
    if (command.type === 'reset') {
      this.world.clear();
      this.nutrientGrid.clear();
      this.terrainGrid.clear();
      this.disasterState.breedingRemaining = 0;
      this.disasterState.meteorTriggered = false;
      this.disasterState.floodTriggered = false;
      this.elapsed = FIXED_STEP;
      this.holdAfterReset = true;
      this.suspendAutoBalance = true;
      return;
    }
    if (command.type === 'update-config') {
      const key = command.key as AdjustableConfigKey;
      this.config[key] = normalizeConfigurationValue(key, command.value, this.config[key]);
      return;
    }
    this.holdAfterReset = false;
    this.suspendAutoBalance = true;
    const speed = command.species === Species.Carnivore ? this.config.carnivoreSpeed : HERBIVORE_BASE_SPEED;
    const sight = command.species === Species.Herbivore ? this.config.herbivoreSight : CARNIVORE_SIGHT;
    for (let index = 0; index < command.count; index += 1) this.world.queueSpawn(command.species, Math.random() * this.config.width, Math.random() * this.config.height, MAX_ENERGY, speed, sight);
    this.world.commitCommands();
  }

  private snapshot(): SimulationSnapshot {
    return {
      simulationId: this.simulationId, sequence: this.sequence, tick: this.sequence, width: this.config.width, height: this.config.height,
      entities: { flags: this.world.flags, species: this.world.species, x: this.world.x, y: this.world.y },
      artifacts: { x: this.world.artifactX.slice(0, this.world.artifactCount), y: this.world.artifactY.slice(0, this.world.artifactCount), remaining: this.world.artifactRemaining.slice(0, this.world.artifactCount), residual: this.world.artifactResidual.slice(0, this.world.artifactCount) },
      terrain: { columns: this.terrainGrid.columns, rows: this.terrainGrid.rows, kinds: this.terrainGrid.kinds, waterFlow: this.terrainGrid.waterFlow },
      nutrient: { columns: this.nutrientGrid.columns, rows: this.nutrientGrid.rows, values: this.nutrientGrid.values },
      counts: { grass: this.world.count(Species.Grass), herbivores: this.world.count(Species.Herbivore), carnivores: this.world.count(Species.Carnivore) },
      config: { ...this.config },
    };
  }
}