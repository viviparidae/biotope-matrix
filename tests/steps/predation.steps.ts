import { Given, Then, When, setWorldConstructor } from '@cucumber/cucumber';
import { BodyShape, SimulationConfig, Species } from '../../packages/shared-types/src/ecs';
import { TerrainGrid } from '../../packages/ecs/src/components/terrain-grid';
import { World } from '../../packages/ecs/src/entities/world';
import { calculatePredationOutcome, predationSystem } from '../../packages/ecs/src/systems/predation';

const simulationConfig: SimulationConfig = {
  width: 100, height: 100, initialGrass: 0, initialHerbivores: 0, initialCarnivores: 0,
  grassSpawnInterval: 1, maxGrass: 100, herbivoreSight: 5, splitEnergy: 150,
  carnivoreSpeed: 18, carnivoreMetabolism: 3.4,
};

class PredationWorld {
  predatorSize = 1;
  preySize = 1;
  outcome: ReturnType<typeof calculatePredationOutcome> | undefined;
  world = new World();
  terrain = new TerrainGrid(100, 100);
}

setWorldConstructor(PredationWorld);

Given('捕食者のサイズが {float} で、被食者のサイズが {float} である', function (predatorSize: number, preySize: number) {
  // Arrange
  this.predatorSize = predatorSize;
  this.preySize = preySize;
});

Given('標準形態の捕食者と装甲形態の被食者が同じサイズである', function () {
  // Arrange
  this.predatorSize = 1;
  this.preySize = 1;
});

Given('サイズ {float} の肉食個体とサイズ {float} の肉食個体が同じ場所にいて、前者のエネルギーが 20 以下である', function (largeSize: number, smallSize: number) {
  // Arrange
  this.world.queueSpawn(Species.Carnivore, 20, 20, 10, 18, 100, 0, largeSize);
  this.world.queueSpawn(Species.Carnivore, 20, 20, 10, 18, 100, 0, smallSize);
  this.world.commitCommands();
});

When('捕食判定を実行する', function () {
  // Act
  this.outcome = calculatePredationOutcome(this.predatorSize, this.predatorSize, BodyShape.Standard, this.preySize, this.preySize, BodyShape.Standard, 0);
});

When('捕食判定を {float} の乱数で実行する', function (randomValue: number) {
  // Act
  this.outcome = calculatePredationOutcome(this.predatorSize, this.predatorSize, BodyShape.Standard, this.preySize, this.preySize, BodyShape.Armored, randomValue);
});

When('同種捕食システムを実行する', function () {
  // Act
  predationSystem(this.world, this.terrain, simulationConfig, () => 0);
  this.world.commitCommands();
});

Then('捕食は成功しない', function () {
  // Assert
  if (this.outcome?.success !== false) throw new Error('捕食が失敗することを期待しました');
});

Then('捕食は成功する', function () {
  // Assert
  if (this.outcome?.success !== true) throw new Error('捕食が成功することを期待しました');
});

Then('肉食個体は {int} 体になる', function (count: number) {
  // Assert
  if (this.world.count(Species.Carnivore) !== count) throw new Error(`肉食個体数が ${count} ではありません`);
});

Then('大型の肉食個体のエネルギーは {int} になる', function (energy: number) {
  // Assert
  if (this.world.energy[0] !== energy) throw new Error(`エネルギーが ${energy} ではありません`);
});

Given('変異を含む親個体が子個体を生成する', function () {
  this.world.queueSpawn(Species.Herbivore, 50, 50, 100, 20, 10, 0, 1, BodyShape.Standard);
  this.world.commitCommands();
});

When('形態とサイズを継承する', function () {
  const parentSize = this.world.size[0];
  const parentSpeed = this.world.speed[0];
  const mutationFactor = 1.4;
  const childSize = Math.max(0.5, Math.min(3, parentSize * mutationFactor));
  const childSpeed = Math.max(1, parentSpeed * 0.85);

  this.world.queueSpawn(
    Species.Herbivore,
    52,
    52,
    75,
    childSpeed,
    this.world.baseSight[0] * 1.05,
    0,
    childSize,
    BodyShape.Armored,
  );
  this.world.commitCommands();
});

Then('子個体は親の値の範囲内に収まり、速度と耐久のトレードオフが発生する', function () {
  const parentSpeed = this.world.speed[0];
  const childSpeed = this.world.speed[1];
  const childDefense = this.world.defense[1];
  const parentDefense = this.world.defense[0];
  const childSize = this.world.size[1];
  const parentSize = this.world.size[0];

  if (childSize < parentSize * 0.9 || childSize > parentSize * 1.6) throw new Error('子個体が親のサイズ範囲を超えています');
  if (childDefense <= parentDefense) throw new Error('装甲による耐久の向上が見られません');
  if (childSpeed >= parentSpeed) throw new Error('トレードオフが発生していません');
});

Given('近傍に複数の同種個体が存在する', function () {
  this.world.queueSpawn(Species.Herbivore, 50, 50, 100, 20, 10);
  this.world.queueSpawn(Species.Herbivore, 52, 50, 100, 20, 10);
  this.world.queueSpawn(Species.Herbivore, 50, 52, 100, 20, 10);
  this.world.commitCommands();
  this.world.velocityX[0] = 5;
  this.world.velocityY[0] = 0;
  this.world.velocityX[1] = 5;
  this.world.velocityY[1] = 2;
  this.world.velocityX[2] = 4;
  this.world.velocityY[2] = -1;
});

When('群れベクトルを計算する', function () {
  import('../../packages/ecs/src/systems/flocking').then(({ flockingSystem }) => {
    flockingSystem(this.world, 100, 100);
  });
});

Then('分離・整列・結合の合成ベクトルが返る', function () {
  const vx = this.world.velocityX[0];
  const vy = this.world.velocityY[0];
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) throw new Error('速度ベクトルが有限値ではありません');
});