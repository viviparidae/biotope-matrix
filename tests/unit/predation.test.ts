import { describe, expect, it } from 'vitest';
import { BodyShape, SimulationConfig, Species } from '../../packages/shared-types/src/ecs';
import { TerrainGrid } from '../../packages/ecs/src/components/terrain-grid';
import { World } from '../../packages/ecs/src/entities/world';
import { calculatePredationOutcome, predationSystem } from '../../packages/ecs/src/systems/predation';

const simulationConfig: SimulationConfig = {
  width: 100, height: 100, initialGrass: 0, initialHerbivores: 0, initialCarnivores: 0,
  grassSpawnInterval: 1, maxGrass: 100, herbivoreSight: 5, splitEnergy: 150,
  carnivoreSpeed: 18, carnivoreMetabolism: 3.4,
};

describe('条件付き捕食', () => {
  it('REQ-PRED-001: 捕食者が被食者の80%未満なら接触しても捕食できない', () => {
    // Arrange
    const outcomeBeforeBoundary = calculatePredationOutcome(0.79, 1, BodyShape.Standard, 1, 1, BodyShape.Standard, 0);
    const outcomeAtBoundary = calculatePredationOutcome(0.8, 1, BodyShape.Standard, 1, 1, BodyShape.Standard, 0);

    // Act
    const beforeSuccess = outcomeBeforeBoundary.success;
    const boundarySuccess = outcomeAtBoundary.success;

    // Assert
    expect(beforeSuccess).toBe(false);
    expect(boundarySuccess).toBe(true);
  });

  it('REQ-PRED-001: 装甲の被食者は同じ攻撃力でも捕食成功率を下げる', () => {
    // Arrange
    const standard = calculatePredationOutcome(1, 1, BodyShape.Standard, 1, 1, BodyShape.Standard, 0.6);
    const armored = calculatePredationOutcome(1, 1, BodyShape.Standard, 1, 1, BodyShape.Armored, 0.6);

    // Act
    const standardResult = standard.success;
    const armoredResult = armored.success;

    // Assert
    expect(standardResult).toBe(true);
    expect(armoredResult).toBe(false);
  });
});

describe('飢餓時の同種捕食', () => {
  it('REQ-CANN-001: 飢餓状態の肉食個体は接触した小型肉食個体を捕食する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(100, 100);
    world.queueSpawn(Species.Carnivore, 20, 20, 10, 18, 100, 0, 2);
    world.queueSpawn(Species.Carnivore, 20, 20, 10, 18, 100, 0, 1);
    world.commitCommands();

    // Act
    predationSystem(world, terrain, simulationConfig, () => 0);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Carnivore)).toBe(1);
    expect(world.energy[0]).toBe(110);
  });
});