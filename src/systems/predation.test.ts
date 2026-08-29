import { describe, expect, it } from 'vitest';
import { BodyShape, Species } from '../../packages/shared-types/src/ecs';
import { World } from '../../packages/ecs/src/entities/world';
import { TerrainGrid } from '../../packages/ecs/src/components/terrain-grid';
import { calculatePredationOutcome, predationSystem } from '../../packages/ecs/src/systems/predation';

describe('REQ-PRED-001: 条件付き捕食判定', () => {
  it('捕食者が被食者の 80% 未満だと成功しない', () => {
    // Arrange
    const predatorSize = 0.79;
    const preySize = 1;

    // Act
    const outcome = calculatePredationOutcome(predatorSize, 1, BodyShape.Standard, preySize, 1, BodyShape.Standard, 0);

    // Assert
    expect(outcome.success).toBe(false);
  });

  it('飢餓状態の肉食個体は小型の同種を対象にする', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(100, 100);
    world.queueSpawn(Species.Carnivore, 10, 10, 20, 18, 100, 0, 2);
    world.queueSpawn(Species.Carnivore, 10, 10, 10, 18, 100, 0, 1);
    world.commitCommands();

    // Act
    predationSystem(world, terrain, { width: 100, height: 100, initialGrass: 0, initialHerbivores: 0, initialCarnivores: 0, grassSpawnInterval: 1, maxGrass: 100, herbivoreSight: 5, splitEnergy: 150, carnivoreSpeed: 18, carnivoreMetabolism: 3.4 }, () => 0);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Carnivore)).toBe(1);
    expect(world.energy[0]).toBe(110);
  });
});
