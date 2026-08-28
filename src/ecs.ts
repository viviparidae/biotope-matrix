import { EntityFlags, MAX_ENTITIES, Species } from './types';

export class World {
  readonly x = new Float32Array(MAX_ENTITIES);
  readonly y = new Float32Array(MAX_ENTITIES);
  readonly velocityX = new Float32Array(MAX_ENTITIES);
  readonly velocityY = new Float32Array(MAX_ENTITIES);
  readonly energy = new Float32Array(MAX_ENTITIES);
  readonly speed = new Float32Array(MAX_ENTITIES);
  readonly sight = new Float32Array(MAX_ENTITIES);
  readonly bornAt = new Float64Array(MAX_ENTITIES);
  readonly flags = new Uint8Array(MAX_ENTITIES);
  readonly species = new Uint8Array(MAX_ENTITIES);
  readonly freeIds = new Uint16Array(MAX_ENTITIES);
  readonly spawnSpecies = new Uint8Array(MAX_ENTITIES);
  readonly spawnX = new Float32Array(MAX_ENTITIES);
  readonly spawnY = new Float32Array(MAX_ENTITIES);
  readonly spawnEnergy = new Float32Array(MAX_ENTITIES);
  readonly spawnSpeed = new Float32Array(MAX_ENTITIES);
  readonly spawnSight = new Float32Array(MAX_ENTITIES);
  readonly spawnBornAt = new Float64Array(MAX_ENTITIES);
  readonly removeIds = new Uint16Array(MAX_ENTITIES);
  private freeCount = MAX_ENTITIES;
  private spawnCount = 0;
  private removeCount = 0;
  activeCount = 0;

  constructor() {
    for (let entity = 0; entity < MAX_ENTITIES; entity += 1) this.freeIds[entity] = MAX_ENTITIES - entity - 1;
  }

  queueSpawn(species: Species, x: number, y: number, energy: number, speed: number, sight: number, bornAt = 0): void {
    if (this.spawnCount >= MAX_ENTITIES) return;
    const index = this.spawnCount;
    this.spawnSpecies[index] = species;
    this.spawnX[index] = x;
    this.spawnY[index] = y;
    this.spawnEnergy[index] = energy;
    this.spawnSpeed[index] = speed;
    this.spawnSight[index] = sight;
    this.spawnBornAt[index] = bornAt;
    this.spawnCount += 1;
  }

  queueRemove(entity: number): void {
    if ((this.flags[entity] & EntityFlags.Alive) === 0 || (this.flags[entity] & EntityFlags.PendingRemoval) !== 0) return;
    this.flags[entity] |= EntityFlags.PendingRemoval;
    this.removeIds[this.removeCount] = entity;
    this.removeCount += 1;
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
      this.speed[entity] = this.spawnSpeed[index];
      this.sight[entity] = this.spawnSight[index];
      this.bornAt[entity] = this.spawnBornAt[index];
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
  }

  count(species: Species): number {
    let total = 0;
    for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
      if ((this.flags[entity] & EntityFlags.Alive) !== 0 && this.species[entity] === species) total += 1;
    }
    return total;
  }
}