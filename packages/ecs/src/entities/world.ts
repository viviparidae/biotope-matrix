import { BodyShape, DECOMPOSITION_NUTRIENT, EntityFlags, MAX_ARTIFACTS, MAX_BODY_SIZE, MAX_ENTITIES, MIN_BODY_SIZE, SHAPE_ATTACK_FACTOR, Species } from '../../../shared-types/src/ecs';

export class World {
  readonly x = new Float32Array(MAX_ENTITIES);
  readonly y = new Float32Array(MAX_ENTITIES);
  readonly velocityX = new Float32Array(MAX_ENTITIES);
  readonly velocityY = new Float32Array(MAX_ENTITIES);
  readonly energy = new Float32Array(MAX_ENTITIES);
  readonly speed = new Float32Array(MAX_ENTITIES);
  readonly baseSpeed = new Float32Array(MAX_ENTITIES);
  readonly sight = new Float32Array(MAX_ENTITIES);
  readonly baseSight = new Float32Array(MAX_ENTITIES);
  readonly metabolismMultiplier = new Float32Array(MAX_ENTITIES);
  readonly size = new Float32Array(MAX_ENTITIES);
  readonly attack = new Float32Array(MAX_ENTITIES);
  readonly defense = new Float32Array(MAX_ENTITIES);
  readonly shape = new Uint8Array(MAX_ENTITIES);
  readonly bornAt = new Float64Array(MAX_ENTITIES);
  readonly wasteCooldown = new Float32Array(MAX_ENTITIES);
  readonly flags = new Uint8Array(MAX_ENTITIES);
  readonly species = new Uint8Array(MAX_ENTITIES);
  readonly freeIds = new Uint16Array(MAX_ENTITIES);
  readonly spawnSpecies = new Uint8Array(MAX_ENTITIES);
  readonly spawnX = new Float32Array(MAX_ENTITIES);
  readonly spawnY = new Float32Array(MAX_ENTITIES);
  readonly spawnEnergy = new Float32Array(MAX_ENTITIES);
  readonly spawnSpeed = new Float32Array(MAX_ENTITIES);
  readonly spawnSight = new Float32Array(MAX_ENTITIES);
  readonly spawnSize = new Float32Array(MAX_ENTITIES);
  readonly spawnShape = new Uint8Array(MAX_ENTITIES);
  readonly spawnBornAt = new Float64Array(MAX_ENTITIES);
  readonly removeIds = new Uint16Array(MAX_ENTITIES);
  readonly artifactX = new Float32Array(MAX_ARTIFACTS);
  readonly artifactY = new Float32Array(MAX_ARTIFACTS);
  readonly artifactRemaining = new Float32Array(MAX_ARTIFACTS);
  readonly artifactResidual = new Float32Array(MAX_ARTIFACTS);
  readonly artifactNutrient = new Float32Array(MAX_ARTIFACTS);
  artifactCount = 0;
  private freeCount = MAX_ENTITIES;
  private spawnCount = 0;
  private removeCount = 0;
  activeCount = 0;

  constructor() {
    for (let entity = 0; entity < MAX_ENTITIES; entity += 1) this.freeIds[entity] = MAX_ENTITIES - entity - 1;
  }

  queueSpawn(species: Species, x: number, y: number, energy: number, speed: number, sight: number, bornAt = 0, size = 1, shape: BodyShape = BodyShape.Standard): void {
    if (this.spawnCount >= MAX_ENTITIES) return;
    const index = this.spawnCount;
    this.spawnSpecies[index] = species;
    this.spawnX[index] = x;
    this.spawnY[index] = y;
    this.spawnEnergy[index] = energy;
    this.spawnSpeed[index] = speed;
    this.spawnSight[index] = sight;
    this.spawnSize[index] = Math.max(MIN_BODY_SIZE, Math.min(MAX_BODY_SIZE, size));
    this.spawnShape[index] = shape;
    this.spawnBornAt[index] = bornAt;
    this.spawnCount += 1;
  }

  queueRemove(entity: number): void {
    if ((this.flags[entity] & EntityFlags.Alive) === 0 || (this.flags[entity] & EntityFlags.PendingRemoval) !== 0) return;
    this.flags[entity] |= EntityFlags.PendingRemoval;
    this.removeIds[this.removeCount] = entity;
    this.removeCount += 1;
  }

  queueDeath(entity: number, decompositionTime: number, residualTime: number): void {
    if ((this.flags[entity] & EntityFlags.Alive) === 0 || (this.flags[entity] & EntityFlags.PendingRemoval) !== 0 || this.species[entity] === Species.Grass) return;
    if (this.artifactCount < MAX_ARTIFACTS) {
      const artifact = this.artifactCount;
      this.artifactX[artifact] = this.x[entity];
      this.artifactY[artifact] = this.y[entity];
      this.artifactRemaining[artifact] = decompositionTime;
      this.artifactResidual[artifact] = residualTime;
      this.artifactNutrient[artifact] = DECOMPOSITION_NUTRIENT;
      this.artifactCount += 1;
    }
    this.queueRemove(entity);
  }

  queueWaste(entity: number, decompositionTime: number, residualTime: number, nutrient: number): void {
    if ((this.flags[entity] & EntityFlags.Alive) === 0 || (this.flags[entity] & EntityFlags.PendingRemoval) !== 0 || this.artifactCount >= MAX_ARTIFACTS) return;
    const artifact = this.artifactCount;
    this.artifactX[artifact] = this.x[entity];
    this.artifactY[artifact] = this.y[entity];
    this.artifactRemaining[artifact] = decompositionTime;
    this.artifactResidual[artifact] = residualTime;
    this.artifactNutrient[artifact] = nutrient;
    this.artifactCount += 1;
  }

  commitCommands(): void {
    for (let index = 0; index < this.removeCount; index += 1) {
      const entity = this.removeIds[index];
      this.flags[entity] = 0;
      this.species[entity] = Species.None;
      this.freeIds[this.freeCount] = entity;
      this.freeCount += 1;
      this.activeCount -= 1;
    }
    for (let index = 0; index < this.spawnCount; index += 1) {
      if (this.freeCount === 0) break;
      const entity = this.freeIds[--this.freeCount];
      this.x[entity] = this.spawnX[index];
      this.y[entity] = this.spawnY[index];
      this.energy[entity] = this.spawnEnergy[index];
      this.speed[entity] = this.spawnSpeed[index] / this.spawnSize[index] * (this.spawnShape[index] === BodyShape.Streamlined ? 1.2 : 1);
      this.baseSpeed[entity] = this.spawnSpeed[index];
      this.sight[entity] = this.spawnSight[index];
      this.baseSight[entity] = this.spawnSight[index];
      this.metabolismMultiplier[entity] = 1;
      this.size[entity] = this.spawnSize[index];
      this.shape[entity] = this.spawnShape[index];
      this.attack[entity] = this.size[entity] * (this.shape[entity] === BodyShape.Spiky ? SHAPE_ATTACK_FACTOR : 1);
      this.defense[entity] = this.size[entity] * (this.shape[entity] === BodyShape.Armored ? 1.25 : 1);
      this.bornAt[entity] = this.spawnBornAt[index];
      this.wasteCooldown[entity] = 0;
      this.velocityX[entity] = 0;
      this.velocityY[entity] = 0;
      this.species[entity] = this.spawnSpecies[index];
      this.flags[entity] = EntityFlags.Alive;
      this.activeCount += 1;
    }
    this.spawnCount = 0;
    this.removeCount = 0;
  }

  clear(): void {
    for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
      this.flags[entity] = 0;
      this.species[entity] = Species.None;
      this.freeIds[entity] = MAX_ENTITIES - entity - 1;
    }
    this.freeCount = MAX_ENTITIES;
    this.spawnCount = 0;
    this.removeCount = 0;
    this.activeCount = 0;
    this.artifactCount = 0;
  }

  count(species: Species): number {
    let total = 0;
    for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
      if ((this.flags[entity] & EntityFlags.Alive) !== 0 && this.species[entity] === species) total += 1;
    }
    return total;
  }
}