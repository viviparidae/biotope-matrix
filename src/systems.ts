import { World } from './ecs';
import { EntityFlags, GRASS_LIFETIME, MAX_ENTITIES, SimulationConfig, SimulationEventHandler, Species } from './types';

const CONTACT_DISTANCE = 3;
const GRASS_ENERGY = 50;
const HERBIVORE_METABOLISM = 2.2;

export function seedWorld(world: World, config: SimulationConfig): void {
  for (let index = 0; index < config.initialGrass; index += 1) world.queueSpawn(Species.Grass, Math.random() * config.width, Math.random() * config.height, 0, 0, 0, 0);
  for (let index = 0; index < config.initialHerbivores; index += 1) world.queueSpawn(Species.Herbivore, Math.random() * config.width, Math.random() * config.height, 100, 22, config.herbivoreSight);
  for (let index = 0; index < config.initialCarnivores; index += 1) world.queueSpawn(Species.Carnivore, Math.random() * config.width, Math.random() * config.height, 100, config.carnivoreSpeed, 100);
  world.commitCommands();
}

export function spawnGrass(world: World, elapsed: number, config: SimulationConfig, onEvent?: SimulationEventHandler): void {
  if (config.grassSpawnInterval > 0 && elapsed % config.grassSpawnInterval < 1 / 60 && world.count(Species.Grass) < config.maxGrass) {
    const x = Math.random() * config.width;
    const y = Math.random() * config.height;
    world.queueSpawn(Species.Grass, x, y, 0, 0, 0, elapsed);
    onEvent?.({ type: 'grass-spawn', x, y });
  }
}

function nearest(world: World, entity: number, targetSpecies: Species, range: number): number {
  let nearestEntity = -1;
  let nearestDistance = range * range;
  for (let candidate = 0; candidate < MAX_ENTITIES; candidate += 1) {
    if ((world.flags[candidate] & EntityFlags.Alive) === 0 || world.species[candidate] !== targetSpecies) continue;
    const deltaX = world.x[candidate] - world.x[entity];
    const deltaY = world.y[candidate] - world.y[entity];
    const distance = deltaX * deltaX + deltaY * deltaY;
    if (distance < nearestDistance) { nearestDistance = distance; nearestEntity = candidate; }
  }
  return nearestEntity;
}

export function behaviorSystem(world: World, config: SimulationConfig): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    const kind = world.species[entity];
    if (kind === Species.Carnivore) world.speed[entity] = config.carnivoreSpeed;
    const target = kind === Species.Herbivore ? nearest(world, entity, Species.Grass, config.herbivoreSight) : kind === Species.Carnivore ? nearest(world, entity, Species.Herbivore, 100) : -1;
    if (target >= 0) {
      const deltaX = world.x[target] - world.x[entity];
      const deltaY = world.y[target] - world.y[entity];
      const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
      world.velocityX[entity] = deltaX / length * world.speed[entity];
      world.velocityY[entity] = deltaY / length * world.speed[entity];
    } else if (kind !== Species.Grass && Math.abs(world.velocityX[entity]) + Math.abs(world.velocityY[entity]) < 0.01) {
      const angle = Math.random() * Math.PI * 2;
      world.velocityX[entity] = Math.cos(angle) * world.speed[entity];
      world.velocityY[entity] = Math.sin(angle) * world.speed[entity];
    }
  }
}

export function movementSystem(world: World, deltaSeconds: number, width: number, height: number): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] === Species.Grass) continue;
    world.x[entity] += world.velocityX[entity] * deltaSeconds;
    world.y[entity] += world.velocityY[entity] * deltaSeconds;
    if (world.x[entity] <= 0 || world.x[entity] >= width) { world.x[entity] = Math.max(0, Math.min(width, world.x[entity])); world.velocityX[entity] *= -1; }
    if (world.y[entity] <= 0 || world.y[entity] >= height) { world.y[entity] = Math.max(0, Math.min(height, world.y[entity])); world.velocityY[entity] *= -1; }
  }
}

export function interactionSystem(world: World, config: SimulationConfig, onEvent?: SimulationEventHandler): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    const kind = world.species[entity];
    if (kind === Species.Herbivore) {
      const grass = nearest(world, entity, Species.Grass, CONTACT_DISTANCE);
      if (grass >= 0) { world.energy[entity] += GRASS_ENERGY; world.queueRemove(grass); }
      if (world.energy[entity] > config.splitEnergy) {
        world.energy[entity] = 75;
        world.queueSpawn(Species.Herbivore, world.x[entity] + 2, world.y[entity] + 2, 75, world.speed[entity] * (0.9 + Math.random() * 0.2), config.herbivoreSight);
        onEvent?.({ type: 'split', x: world.x[entity], y: world.y[entity] });
      }
    } else if (kind === Species.Carnivore) {
      const prey = nearest(world, entity, Species.Herbivore, CONTACT_DISTANCE);
      if (prey >= 0) {
        world.energy[entity] += 100;
        world.queueRemove(prey);
        onEvent?.({ type: 'predation', x: world.x[entity], y: world.y[entity] });
      }
    }
  }
}

export function lifecycleSystem(world: World, elapsed: number, deltaSeconds: number, config: SimulationConfig): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    if (world.species[entity] === Species.Grass) { if (elapsed - world.bornAt[entity] > GRASS_LIFETIME) world.queueRemove(entity); }
    else { world.energy[entity] -= (world.species[entity] === Species.Herbivore ? HERBIVORE_METABOLISM : config.carnivoreMetabolism) * deltaSeconds; if (world.energy[entity] <= 0) world.queueRemove(entity); }
  }
}

export function drawSystem(world: World, context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    const kind = world.species[entity];
    context.fillStyle = kind === Species.Grass ? '#65d66f' : kind === Species.Herbivore ? '#dbeafe' : '#ef4444';
    const size = kind === Species.Grass ? 1 : kind === Species.Herbivore ? 2 : 3;
    context.fillRect(Math.floor(world.x[entity]), Math.floor(world.y[entity]), size, size);
  }
}