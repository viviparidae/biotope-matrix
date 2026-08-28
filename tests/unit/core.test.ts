import { describe, expect, it } from 'vitest';
import { NutrientGrid } from '../../packages/ecs/src/components/nutrient-grid';
import { TerrainGrid, TerrainKind } from '../../packages/ecs/src/components/terrain-grid';
import { World } from '../../packages/ecs/src/entities/world';
import { DECOMPOSITION_TIME, EntityFlags, NUTRIENT_RESIDUAL_TIME, SimulationConfig, Species } from '../../packages/shared-types/src/ecs';
import { environmentSystem, interactionSystem, lifecycleSystem } from '../../packages/ecs/src/systems/simulation-systems';

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
  carnivoreSpeed: 12,
  carnivoreMetabolism: 2,
};

describe('栄養グリッド', () => {
  it('座標と栄養値をグリッドの範囲内に制限する', () => {
    // Arrange
    const grid = new NutrientGrid(48, 48);

    // Act
    grid.add(-10, -10, 300);
    grid.consume(100, 100, 50);

    // Assert
    expect(grid.sample(0, 0)).toBe(255);
    expect(grid.sample(47, 47)).toBe(0);
    expect(grid.sample(-1, -1)).toBe(255);
  });

  it('負の変更量を無視し、すべてのセルをクリアする', () => {
    // Arrange
    const grid = new NutrientGrid(24, 24);

    // Act
    grid.add(1, 1, 40);
    grid.add(1, 1, -100);
    grid.consume(1, 1, -100);
    expect(grid.sample(1, 1)).toBe(40);

    grid.clear();

    // Assert
    expect(grid.sample(1, 1)).toBe(0);
  });
});

describe('ワールド', () => {
  it('キューに入れた Entity を確定し、削除済み ID を再利用する', () => {
    // Arrange
    const world = new World();

    // Act
    world.queueSpawn(Species.Herbivore, 10, 20, 100, 22, 5, 3);
    world.commitCommands();
    const entity = 0;

    expect(world.activeCount).toBe(1);
    expect(world.flags[entity] & EntityFlags.Alive).toBe(EntityFlags.Alive);
    expect(world.species[entity]).toBe(Species.Herbivore);
    expect(world.bornAt[entity]).toBe(3);

    world.queueRemove(entity);
    world.commitCommands();
    expect(world.activeCount).toBe(0);
    expect(world.count(Species.Herbivore)).toBe(0);

    world.queueSpawn(Species.Grass, 4, 5, 0, 0, 0);
    world.commitCommands();

    // Assert
    expect(world.activeCount).toBe(1);
    expect(world.species[entity]).toBe(Species.Grass);
  });

  it('生存中の草以外の Entity の死亡ごとに分解アーティファクトを 1 件生成する', () => {
    // Arrange
    const world = new World();
    world.queueSpawn(Species.Carnivore, 12, 14, 100, 18, 100);
    world.commitCommands();

    // Act
    world.queueDeath(0, DECOMPOSITION_TIME, NUTRIENT_RESIDUAL_TIME);
    world.queueDeath(0, DECOMPOSITION_TIME, NUTRIENT_RESIDUAL_TIME);

    // Assert
    expect(world.artifactCount).toBe(1);
    expect(world.artifactRemaining[0]).toBe(DECOMPOSITION_TIME);
    expect(world.artifactResidual[0]).toBe(NUTRIENT_RESIDUAL_TIME);
  });
});

describe('地形グリッド', () => {
  it('圧力が閾値に達したとき平地を別の地形へ遷移させる', () => {
    // Arrange
    const terrain = new TerrainGrid(24, 24);
    const changes: Array<[number, TerrainKind]> = [];

    // Act
    for (let index = 0; index < 5; index += 1) terrain.addGrazing(12, 12);
    terrain.evaluate((index, kind) => changes.push([index, kind]));

    // Assert
    expect(terrain.kindAt(12, 12)).toBe(TerrainKind.Desert);
    expect(changes).toEqual([[0, TerrainKind.Desert]]);
    expect(terrain.speedMultiplier(12, 12)).toBe(0.5);
  });

  it('洪水を進行させ、高さを超えた時点で終了する', () => {
    // Arrange
    const terrain = new TerrainGrid(24, 100);

    // Act
    terrain.startFlood();
    terrain.advanceFlood(1, 100);

    // Assert
    expect(terrain.waterFlow).toBe(-1);
  });
});

describe('生態系システム', () => {
  it('分裂した子は親の速度と視野を同じ変異率で受け継ぐ', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Herbivore, 20, 20, 151, 22, 5);
    world.commitCommands();
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    // Act
    interactionSystem(world, terrain, simulationConfig);
    world.commitCommands();
    Math.random = originalRandom;

    // Assert
    expect(world.count(Species.Herbivore)).toBe(2);
    expect(world.speed[1]).toBe(22);
    expect(world.sight[1]).toBe(5);
  });

  it('速い草食個体ほど同じ時間に多くのエネルギーを消費する', () => {
    // Arrange
    const world = new World();
    world.queueSpawn(Species.Herbivore, 10, 10, 100, 11, 5);
    world.queueSpawn(Species.Herbivore, 20, 20, 100, 22, 5);
    world.commitCommands();

    // Act
    lifecycleSystem(world, 0, 1, simulationConfig);

    // Assert
    expect(world.energy[0]).toBeCloseTo(98.9);
    expect(world.energy[1]).toBeCloseTo(97.8);
  });

  it('夜間と低温を適用しても環境倍率が累積しない', () => {
    // Arrange
    const world = new World();
    world.queueSpawn(Species.Herbivore, 10, 10, 100, 22, 5);
    world.commitCommands();

    // Act
    environmentSystem(world, 0.1, 5);
    environmentSystem(world, 0.1, 5);

    // Assert
    expect(world.sight[0]).toBe(2.5);
    expect(world.speed[0]).toBeCloseTo(15.4);
    expect(world.metabolismMultiplier[0]).toBe(1.25);
  });
});