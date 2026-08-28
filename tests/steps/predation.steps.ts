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