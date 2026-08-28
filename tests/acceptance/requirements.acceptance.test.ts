import { describe, expect, it, vi } from 'vitest';
import { NutrientGrid } from '../../packages/ecs/src/components/nutrient-grid';
import { TerrainGrid, TerrainKind } from '../../packages/ecs/src/components/terrain-grid';
import { World } from '../../packages/ecs/src/entities/world';
import { behaviorSystem, decompositionSystem, disasterSystem, environmentSystem, interactionSystem, lifecycleSystem, movementSystem, spawnGrass, terrainSystem } from '../../packages/ecs/src/systems/simulation-systems';
import { DECOMPOSITION_TIME, EntityFlags, FIXED_STEP, SimulationConfig, Species, WASTE_DECOMPOSITION_TIME, WASTE_NUTRIENT } from '../../packages/shared-types/src/ecs';

const acceptanceConfig: SimulationConfig = {
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

describe('要求仕様の受け入れ', () => {
  it('明るい環境では上限未満の草が1秒判定で1株増える', () => {
    // Arrange
    const world = new World();
    const config = { ...acceptanceConfig, brightness: 1 };
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // Act
    spawnGrass(world, 1, config);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Grass)).toBe(1);
    vi.restoreAllMocks();
  });

  it('夜間は草の発生を停止する', () => {
    // Arrange
    const world = new World();
    const config = { ...acceptanceConfig, brightness: 0.1 };

    // Act
    spawnGrass(world, 1, config);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Grass)).toBe(0);
  });

  it('発生から30秒経過した草は自然に消滅する', () => {
    // Arrange
    const world = new World();
    world.queueSpawn(Species.Grass, 10, 10, 0, 0, 0, 0);
    world.commitCommands();

    // Act
    lifecycleSystem(world, 30, FIXED_STEP, acceptanceConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Grass)).toBe(0);
  });

  it('草食個体は最寄りの草へ向かい、接触すると草を食べて50回復する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 96);
    world.queueSpawn(Species.Herbivore, 10, 10, 40, 22, 5);
    world.queueSpawn(Species.Grass, 12, 10, 0, 0, 0);
    world.commitCommands();

    // Act
    behaviorSystem(world, terrain, acceptanceConfig);
    movementSystem(world, terrain, FIXED_STEP, 240, 240);
    interactionSystem(world, terrain, acceptanceConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Grass)).toBe(0);
    expect(world.energy[0]).toBeGreaterThan(40);
  });

  it('エネルギーが150を超えた草食個体は親子2体へ分裂する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Herbivore, 20, 20, 151, 22, 5);
    world.commitCommands();

    // Act
    interactionSystem(world, terrain, acceptanceConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Herbivore)).toBe(2);
    expect(world.energy[0]).toBe(75);
    expect(world.energy[1]).toBe(75);
  });

  it('エネルギーが150を超えた肉食個体は親子2体へ分裂する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Carnivore, 20, 20, 151, 18, 100);
    world.commitCommands();

    // Act
    interactionSystem(world, terrain, acceptanceConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Carnivore)).toBe(2);
    expect(world.energy[0]).toBe(75);
    expect(world.energy[1]).toBe(75);
  });

  it('肉食個体は視野内の草食個体を追尾し、接触すると死骸を残して100回復する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Carnivore, 30, 30, 40, 18, 100);
    world.queueSpawn(Species.Herbivore, 30, 30, 100, 22, 5);
    world.commitCommands();

    // Act
    behaviorSystem(world, terrain, acceptanceConfig);
    interactionSystem(world, terrain, acceptanceConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Herbivore)).toBe(0);
    expect(world.artifactCount).toBe(1);
    expect(world.energy[0]).toBeGreaterThan(40);
  });

  it('獲物がいない肉食個体は停止状態から徘徊を始める', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Carnivore, 30, 30, 100, 18, 100);
    world.commitCommands();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    // Act
    behaviorSystem(world, terrain, acceptanceConfig);

    // Assert
    expect(world.velocityX[0]).toBeCloseTo(18);
    expect(world.velocityY[0]).toBeCloseTo(0);
    vi.restoreAllMocks();
  });

  it('夜間は視野を半分にし、低温では速度を70%に下げる', () => {
    // Arrange
    const world = new World();
    world.queueSpawn(Species.Herbivore, 10, 10, 100, 22, 5);
    world.commitCommands();

    // Act
    environmentSystem(world, 0.1, 5);

    // Assert
    expect(world.sight[0]).toBe(2.5);
    expect(world.speed[0]).toBeCloseTo(15.4);
  });

  it('死亡した個体は分解後に栄養をフィールドへ戻す', () => {
    // Arrange
    const world = new World();
    const nutrients = new NutrientGrid(240, 240);
    const terrain = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Herbivore, 20, 20, 1, 22, 5);
    world.commitCommands();

    // Act
    lifecycleSystem(world, 0, 1, acceptanceConfig);
    world.commitCommands();
    decompositionSystem(world, nutrients, terrain, DECOMPOSITION_TIME);

    // Assert
    expect(world.count(Species.Herbivore)).toBe(0);
    expect(nutrients.sample(20, 20)).toBeGreaterThan(0);
  });

  it('生存中の個体が排泄した排泄物も分解後に栄養をフィールドへ戻す', () => {
    // Arrange
    const world = new World();
    const nutrients = new NutrientGrid(240, 240);
    const terrain = new TerrainGrid(240, 240);
    world.queueSpawn(Species.Herbivore, 20, 20, 100, 22, 5);
    world.commitCommands();

    // Act
    lifecycleSystem(world, 0, FIXED_STEP, acceptanceConfig);
    decompositionSystem(world, nutrients, terrain, WASTE_DECOMPOSITION_TIME);

    // Assert
    expect(world.count(Species.Herbivore)).toBe(1);
    expect(nutrients.sample(20, 20)).toBe(WASTE_NUTRIENT);
  });

  it('採食圧が蓄積した場所は砂漠化し移動速度が半分になる', () => {
    // Arrange
    const terrain = new TerrainGrid(24, 24);
    for (let index = 0; index < 5; index += 1) terrain.addGrazing(12, 12);

    // Act
    terrainSystem(terrain);

    // Assert
    expect(terrain.kindAt(12, 12)).toBe(TerrainKind.Desert);
    expect(terrain.speedMultiplier(12, 12)).toBe(0.5);
  });

  it('草食個体50体以上で大繁殖イベントを発生させる', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    const state = { breedingRemaining: 0, meteorTriggered: false, floodTriggered: false };
    for (let index = 0; index < 50; index += 1) world.queueSpawn(Species.Herbivore, index, 10, 100, 22, 5);
    world.commitCommands();
    const events: string[] = [];

    // Act
    disasterSystem(world, terrain, state, 240, 240, acceptanceConfig, (event) => events.push(event.type));

    // Assert
    expect(state.breedingRemaining).toBeGreaterThan(0);
    expect(events).toContain('breeding-mode');
  });

  it('草食個体が30体を超えて肉食個体がいないとき1体を補充する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    const state = { breedingRemaining: 0, meteorTriggered: false, floodTriggered: false };
    for (let index = 0; index < 31; index += 1) world.queueSpawn(Species.Herbivore, index, 10, 100, 22, 5);
    world.commitCommands();

    // Act
    disasterSystem(world, terrain, state, 240, 240, acceptanceConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Carnivore)).toBe(1);
    expect(world.x[31]).toBe(239);
    expect(world.y[31]).toBe(120);
  });

  it('人口閾値を超えると隕石でクレーターと死骸が発生する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    const state = { breedingRemaining: 0, meteorTriggered: false, floodTriggered: false };
    for (let index = 0; index < 115; index += 1) world.queueSpawn(Species.Herbivore, 120, 120, 100, 22, 5);
    world.commitCommands();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // Act
    disasterSystem(world, terrain, state, 240, 240, acceptanceConfig);

    // Assert
    expect(state.meteorTriggered).toBe(true);
    expect(terrain.kindAt(120, 120)).toBe(TerrainKind.Crater);
    expect(world.artifactCount).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('湿地が広がると洪水を開始し個体の位置を再配置する', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    const state = { breedingRemaining: 0, meteorTriggered: false, floodTriggered: false };
    for (let index = 0; index < 30; index += 1) {
      const column = index % 10;
      const row = Math.floor(index / 10);
      for (let pressure = 0; pressure < 9; pressure += 1) terrain.addDecomposition(column * 24 + 12, row * 24 + 12);
    }
    world.queueSpawn(Species.Herbivore, 1, 1, 100, 22, 5);
    world.commitCommands();
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    // Act
    terrainSystem(terrain);
    disasterSystem(world, terrain, state, 240, 240, acceptanceConfig);

    // Assert
    expect(state.floodTriggered).toBe(true);
    expect(terrain.waterFlow).toBe(0);
    expect(world.x[0]).toBe(180);
    vi.restoreAllMocks();
  });
});
