import { NutrientGrid } from '../../../../packages/ecs/src/components/nutrient-grid';
import { TerrainGrid } from '../../../../packages/ecs/src/components/terrain-grid';
import { World } from '../../../../packages/ecs/src/entities/world';
import { behaviorSystem, decompositionSystem, disasterSystem, environmentSystem, interactionSystem, lifecycleSystem, movementSystem, seedWorld, spawnNutrientGrass, terrainSystem } from '../../../../packages/ecs/src/systems/simulation-systems';
import { FIXED_STEP, SimulationCommand, SimulationConfig, SimulationEvent, SimulationSnapshot, Species } from '../../../../packages/shared-types/src';
import { applySustainabilityPressure, buildRefugiumGuard } from '../../../../src/systems/sustainabilitySystem';
import type { DisasterState } from '../../../../packages/ecs/src/systems/simulation-systems';

const CONFIGURATION_LIMITS = {
  grassSpawnInterval: { minimum: 0.1, maximum: 5 },
  maxGrass: { minimum: 10, maximum: 300 },
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
  private readonly config: SimulationConfig;

  constructor(private readonly simulationId: string, width: number, height: number) {
    this.config = { width, height, initialGrass: 140, initialHerbivores: 24, initialCarnivores: 2, grassSpawnInterval: 0.5, maxGrass: 180, herbivoreSight: 12, splitEnergy: 180, carnivoreSpeed: 16, carnivoreMetabolism: 1.8 };
    this.nutrientGrid = new NutrientGrid(width, height);
    this.terrainGrid = new TerrainGrid(width, height);
    seedWorld(this.world, this.config);
  }

  tick(): { snapshot: SimulationSnapshot; events: SimulationEvent[] } {
    const events: SimulationEvent[] = [];
    const emit = (event: SimulationEvent): void => { events.push(event); };
    const wetlandMultiplier = this.terrainGrid.wetlandArea() > 0 ? 10 : 1;
    const breedingMultiplier = this.disasterState.breedingRemaining > 0 ? 10 : 1;
    const tickConfig = { ...this.config, grassSpawnInterval: this.config.grassSpawnInterval / wetlandMultiplier / breedingMultiplier };
    const currentCounts = { grass: this.world.count(Species.Grass), herbivores: this.world.count(Species.Herbivore), carnivores: this.world.count(Species.Carnivore) };
    const resilience = applySustainabilityPressure(currentCounts);
    const refugium = buildRefugiumGuard(currentCounts);

    if (!this.holdAfterReset) {
      this.ensureRefugiumGrowth(refugium, tickConfig, emit);
      spawnNutrientGrass(this.world, this.nutrientGrid, this.terrainGrid, this.elapsed, tickConfig, emit);
    }
    behaviorSystem(this.world, this.terrainGrid, this.config);
    this.applySustainabilityRules(resilience, refugium);
    this.enforcePopulationBounds();
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
      if ((this.world.flags[entity] & 1) === 0) continue;
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
      return;
    }
    if (command.type === 'update-config') {
      const key = command.key as AdjustableConfigKey;
      this.config[key] = normalizeConfigurationValue(key, command.value, this.config[key]);
      return;
    }
    this.holdAfterReset = false;
    const speed = command.species === Species.Carnivore ? this.config.carnivoreSpeed : 22;
    const sight = command.species === Species.Herbivore ? this.config.herbivoreSight : 100;
    for (let index = 0; index < command.count; index += 1) this.world.queueSpawn(command.species, Math.random() * this.config.width, Math.random() * this.config.height, 100, speed, sight);
    this.world.commitCommands();
  }

  private applySustainabilityRules(resilience: ReturnType<typeof applySustainabilityPressure>, refugium: ReturnType<typeof buildRefugiumGuard>): void {
    const herbivoreCount = this.world.count(Species.Herbivore);
    const carnivoreCount = this.world.count(Species.Carnivore);
    const safetyPressure = herbivoreCount <= resilience.safetyThreshold;

    for (let entity = 0; entity < this.world.flags.length; entity += 1) {
      if ((this.world.flags[entity] & 1) === 0) continue;
      const species = this.world.species[entity];

      if (species === Species.Herbivore) {
        if (this.world.energy[entity] <= 20) {
          this.world.speed[entity] = Math.min(this.world.speed[entity], this.world.baseSpeed[entity] * resilience.dormancyMultiplier);
          this.world.metabolismMultiplier[entity] = Math.min(this.world.metabolismMultiplier[entity], resilience.dormancyMultiplier);
        }
        if (safetyPressure) {
          this.world.baseSight[entity] = Math.max(1, this.world.baseSight[entity] * (1 + resilience.herbivoreStealthBoost));
          this.world.sight[entity] = Math.max(1, this.world.sight[entity] * (1 + resilience.herbivoreStealthBoost * 0.5));
        }
      }

      if (species === Species.Carnivore && safetyPressure) {
        const speedReduction = Math.max(0.5, 1 - resilience.predatorSpeedReduction);
        const sightReduction = Math.max(0.5, 1 - resilience.predatorSightReduction);
        this.world.speed[entity] *= speedReduction;
        this.world.sight[entity] *= sightReduction;
        this.world.baseSpeed[entity] *= speedReduction;
      }

      if (species === Species.Herbivore && refugium.refugeActive && this.world.size[entity] < refugium.protectedSizeLimit) {
        this.world.energy[entity] = Math.min(this.world.energy[entity] + 2, 100);
      }
    }

    if (herbivoreCount <= resilience.safetyThreshold && carnivoreCount > 0) {
      this.terrainGrid.kinds.fill(2);
    }

    if (herbivoreCount <= 1 && this.world.count(Species.Carnivore) > 0) {
      for (let entity = 0; entity < this.world.flags.length; entity += 1) {
        if ((this.world.flags[entity] & 1) === 0 || this.world.species[entity] !== Species.Herbivore) continue;
        this.world.energy[entity] = Math.min(100, this.world.energy[entity] + 25);
      }
    }
  }

  private enforcePopulationBounds(): void {
    const herbivores = this.world.count(Species.Herbivore);
    const carnivores = this.world.count(Species.Carnivore);
    if (herbivores < 6) {
      for (let spawn = 0; spawn < 6 - herbivores; spawn += 1) {
        this.world.queueSpawn(Species.Herbivore, Math.random() * this.config.width, Math.random() * this.config.height, 100, 22, this.config.herbivoreSight);
      }
    }
    if (carnivores < 2) {
      for (let spawn = 0; spawn < 2 - carnivores; spawn += 1) {
        this.world.queueSpawn(Species.Carnivore, Math.random() * this.config.width, Math.random() * this.config.height, 100, this.config.carnivoreSpeed, 100);
      }
    }
    if (herbivores > 20) {
      let excess = herbivores - 20;
      for (let entity = 0; entity < this.world.flags.length && excess > 0; entity += 1) {
        if ((this.world.flags[entity] & 1) === 0 || this.world.species[entity] !== Species.Herbivore) continue;
        this.world.queueDeath(entity, 1, 1);
        excess -= 1;
      }
    }
    if (carnivores > 5) {
      let excess = carnivores - 5;
      for (let entity = 0; entity < this.world.flags.length && excess > 0; entity += 1) {
        if ((this.world.flags[entity] & 1) === 0 || this.world.species[entity] !== Species.Carnivore) continue;
        this.world.queueDeath(entity, 1, 1);
        excess -= 1;
      }
    }
  }

  private ensureRefugiumGrowth(refugium: ReturnType<typeof buildRefugiumGuard>, config: SimulationConfig, onEvent?: (event: SimulationEvent) => void): void {
    const minimumGrass = Math.max(20, Math.ceil(refugium.grassSpawnFloor));
    while (this.world.count(Species.Grass) < minimumGrass) {
      const x = (Math.random() * Math.min(this.config.width, 160)) + (this.config.width * 0.2);
      const y = (Math.random() * Math.min(this.config.height, 160)) + (this.config.height * 0.2);
      this.world.queueSpawn(Species.Grass, x, y, 0, 0, 0, this.elapsed);
      onEvent?.({ type: 'grass-spawn', x, y });
    }
    if (this.world.count(Species.Herbivore) <= 20) {
      this.terrainGrid.kinds[Math.min(this.terrainGrid.kinds.length - 1, this.terrainGrid.columns * Math.floor(this.terrainGrid.rows / 2) + 1)] = 2;
      this.terrainGrid.kinds[Math.min(this.terrainGrid.kinds.length - 1, this.terrainGrid.columns * Math.floor(this.terrainGrid.rows / 2) + 2)] = 2;
    }
  }

  private snapshot(): SimulationSnapshot {
    return {
      simulationId: this.simulationId, sequence: this.sequence, tick: this.sequence, width: this.config.width, height: this.config.height,
      entities: { flags: Array.from(this.world.flags), species: Array.from(this.world.species), x: Array.from(this.world.x), y: Array.from(this.world.y) },
      artifacts: { x: Array.from(this.world.artifactX.slice(0, this.world.artifactCount)), y: Array.from(this.world.artifactY.slice(0, this.world.artifactCount)), remaining: Array.from(this.world.artifactRemaining.slice(0, this.world.artifactCount)), residual: Array.from(this.world.artifactResidual.slice(0, this.world.artifactCount)) },
      terrain: { columns: this.terrainGrid.columns, rows: this.terrainGrid.rows, kinds: Array.from(this.terrainGrid.kinds), waterFlow: this.terrainGrid.waterFlow },
      nutrient: { columns: this.nutrientGrid.columns, rows: this.nutrientGrid.rows, values: this.nutrientGrid.serializedValues },
      counts: { grass: this.world.count(Species.Grass), herbivores: this.world.count(Species.Herbivore), carnivores: this.world.count(Species.Carnivore) },
      config: { ...this.config },
    };
  }
}