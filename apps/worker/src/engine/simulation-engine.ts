import { NutrientGrid } from '../../../../packages/ecs/src/components/nutrient-grid';
import { TerrainGrid } from '../../../../packages/ecs/src/components/terrain-grid';
import { World } from '../../../../packages/ecs/src/entities/world';
import { behaviorSystem, decompositionSystem, disasterSystem, environmentSystem, interactionSystem, lifecycleSystem, movementSystem, seedWorld, spawnNutrientGrass, terrainSystem } from '../../../../packages/ecs/src/systems/simulation-systems';
import { FIXED_STEP, SimulationCommand, SimulationConfig, SimulationEvent, SimulationSnapshot, Species } from '../../../../packages/shared-types/src';
import type { DisasterState } from '../../../../packages/ecs/src/systems/simulation-systems';

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
    this.config = { width, height, initialGrass: 80, initialHerbivores: 18, initialCarnivores: 3, grassSpawnInterval: 1, maxGrass: 100, herbivoreSight: 5, splitEnergy: 150, carnivoreSpeed: 18, carnivoreMetabolism: 3.4 };
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
    if (!this.holdAfterReset) spawnNutrientGrass(this.world, this.nutrientGrid, this.terrainGrid, this.elapsed, tickConfig, emit);
    behaviorSystem(this.world, this.terrainGrid, this.config);
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
      this.config[command.key] = command.value;
      return;
    }
    this.holdAfterReset = false;
    const speed = command.species === Species.Carnivore ? this.config.carnivoreSpeed : 22;
    const sight = command.species === Species.Herbivore ? this.config.herbivoreSight : 100;
    for (let index = 0; index < command.count; index += 1) this.world.queueSpawn(command.species, Math.random() * this.config.width, Math.random() * this.config.height, 100, speed, sight);
    this.world.commitCommands();
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