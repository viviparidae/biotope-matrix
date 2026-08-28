import { describe, expect, it } from 'vitest';
import { NutrientGrid } from '../../packages/ecs/src/components/nutrient-grid';
import { TerrainGrid } from '../../packages/ecs/src/components/terrain-grid';
import { World } from '../../packages/ecs/src/entities/world';
import { behaviorSystem, decompositionSystem, interactionSystem, lifecycleSystem, movementSystem } from '../../packages/ecs/src/systems/simulation-systems';
import { DECOMPOSITION_TIME, EntityFlags, FIXED_STEP, SimulationConfig, Species } from '../../packages/shared-types/src/ecs';

const simulationConfig: SimulationConfig = {
  width: 240,
  height: 240,
  initialGrass: 0,
  initialHerbivores: 0,
  initialCarnivores: 0,
  grassSpawnInterval: 1,
  maxGrass: 100,
  herbivoreSight: 5,
  splitEnergy: 150,
  carnivoreSpeed: 18,
  carnivoreMetabolism: 3.4,
};

describe('シミュレーション統合', () => {
  it('1 tickのシステム連携で採餌と捕食が分解栄養へつながる', () => {
    // Arrange
    const world = new World();
    const nutrientGrid = new NutrientGrid(240, 240);
    const terrainGrid = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Grass, 20, 20, 0, 0, 0);
    world.queueSpawn(Species.Herbivore, 20, 20, 100, 22, 5);
    world.queueSpawn(Species.Carnivore, 20, 20, 100, 18, 100);
    world.commitCommands();

    // Act
    behaviorSystem(world, terrainGrid, simulationConfig);
    movementSystem(world, terrainGrid, FIXED_STEP, simulationConfig.width, simulationConfig.height);
    interactionSystem(world, terrainGrid, simulationConfig);
    lifecycleSystem(world, 0, FIXED_STEP, simulationConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Grass)).toBe(0);
    expect(world.count(Species.Herbivore)).toBe(0);
    expect(world.count(Species.Carnivore)).toBe(2);
    expect(world.artifactCount).toBe(2);
    expect(world.energy[2]).toBeCloseTo(75, 0);
    expect(world.energy[1]).toBe(75);

    // Act
    decompositionSystem(world, nutrientGrid, terrainGrid, DECOMPOSITION_TIME);

    // Assert
    expect(nutrientGrid.sample(20, 20)).toBeGreaterThan(0);
    expect(world.artifactRemaining[0]).toBe(-1);
  });

  it('分裂した子はコマンド確定まで観測されず、確定後に親子として存在する', () => {
    // Arrange
    const world = new World();
    const terrainGrid = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Herbivore, 40, 40, 151, 22, 5);
    world.commitCommands();

    // Act
    interactionSystem(world, terrainGrid, simulationConfig);

    // Assert
    expect(world.count(Species.Herbivore)).toBe(1);
    expect((world.flags[0] & EntityFlags.Alive) !== 0).toBe(true);

    // Act
    world.commitCommands();

    // Assert
    expect(world.count(Species.Herbivore)).toBe(2);
    expect(world.energy[0]).toBe(75);
  });
});
