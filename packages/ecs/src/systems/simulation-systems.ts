import { NutrientGrid } from '../components/nutrient-grid';
import { TerrainGrid, TerrainKind, TERRAIN_CELL_SIZE } from '../components/terrain-grid';
import { World } from '../entities/world';
import { BREEDING_MODE_DURATION, CARNIVORE_ENERGY_GAIN, CARNIVORE_REPLENISH_HERBIVORE_THRESHOLD, CARNIVORE_SIGHT, COLD_METABOLISM_FACTOR, COLD_SPEED_FACTOR, COLD_TEMPERATURE, CONTACT_DISTANCE, CRATER_RADIUS, DECOMPOSITION_NUTRIENT, DECOMPOSITION_TIME, ENERGY_AFTER_SPLIT, EntityFlags, FLOOD_WETLAND_THRESHOLD, FIXED_STEP, GRASS_ENERGY, GRASS_LIFETIME, GRASS_NUTRIENT_CONSUMPTION, HERBIVORE_BASE_SPEED, HERBIVORE_BREEDING_THRESHOLD, HERBIVORE_METABOLISM, MAX_ENTITIES, MUTATION_FACTOR_RANGE, MUTATION_MIN_FACTOR, NIGHT_BRIGHTNESS, NIGHT_SIGHT_FACTOR, NUTRIENT_RESIDUAL_TIME, POPULATION_METEOR_THRESHOLD, RANDOM_GRASS_NUTRIENT_CONSUMPTION, SimulationConfig, SimulationEventHandler, Species, WASTE_DECOMPOSITION_TIME, WASTE_INTERVAL, WASTE_NUTRIENT, WASTE_RESIDUAL_TIME } from '../../../shared-types/src/ecs';

export function seedWorld(world: World, config: SimulationConfig): void {
  for (let index = 0; index < config.initialGrass; index += 1) world.queueSpawn(Species.Grass, Math.random() * config.width, Math.random() * config.height, 0, 0, 0, 0);
  for (let index = 0; index < config.initialHerbivores; index += 1) world.queueSpawn(Species.Herbivore, Math.random() * config.width, Math.random() * config.height, 100, 22, config.herbivoreSight);
  for (let index = 0; index < config.initialCarnivores; index += 1) world.queueSpawn(Species.Carnivore, Math.random() * config.width, Math.random() * config.height, 100, config.carnivoreSpeed, 100);
  world.commitCommands();
}

export function spawnGrass(world: World, elapsed: number, config: SimulationConfig, onEvent?: SimulationEventHandler): void {
  if (config.brightness !== undefined && config.brightness < NIGHT_BRIGHTNESS) return;
  if (config.grassSpawnInterval > 0 && elapsed % config.grassSpawnInterval < FIXED_STEP && world.count(Species.Grass) < config.maxGrass) {
    const x = Math.random() * config.width;
    const y = Math.random() * config.height;
    world.queueSpawn(Species.Grass, x, y, 0, 0, 0, elapsed);
    onEvent?.({ type: 'grass-spawn', x, y });
  }
}

export function spawnNutrientGrass(world: World, grid: NutrientGrid, terrain: TerrainGrid, elapsed: number, config: SimulationConfig, onEvent?: SimulationEventHandler): void {
  if (config.brightness !== undefined && config.brightness < NIGHT_BRIGHTNESS) return;
  if (config.grassSpawnInterval <= 0 || elapsed % config.grassSpawnInterval >= FIXED_STEP || world.count(Species.Grass) >= config.maxGrass) return;
  let selectedX = Math.random() * config.width;
  let selectedY = Math.random() * config.height;
  let selectedWeight = -1;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidateX = Math.random() * config.width;
    const candidateY = Math.random() * config.height;
    const weight = grid.sample(candidateX, candidateY) + 1;
    if (Math.random() * 256 < weight && weight > selectedWeight) {
      selectedX = candidateX;
      selectedY = candidateY;
      selectedWeight = weight;
    }
  }
  if (terrain.isWall(selectedX, selectedY)) return;
  world.queueSpawn(Species.Grass, selectedX, selectedY, 0, 0, 0, elapsed);
  grid.consume(selectedX, selectedY, selectedWeight > 0 ? GRASS_NUTRIENT_CONSUMPTION : RANDOM_GRASS_NUTRIENT_CONSUMPTION);
  onEvent?.({ type: 'grass-spawn', x: selectedX, y: selectedY });
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

export function behaviorSystem(world: World, terrain: TerrainGrid, config: SimulationConfig): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    const kind = world.species[entity];
    if (kind === Species.Carnivore) {
      world.baseSpeed[entity] = config.carnivoreSpeed;
      world.speed[entity] = config.carnivoreSpeed;
    }
    const target = kind === Species.Herbivore ? nearest(world, entity, Species.Grass, config.herbivoreSight) : kind === Species.Carnivore ? nearest(world, entity, Species.Herbivore, CARNIVORE_SIGHT) : -1;
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

export function environmentSystem(world: World, brightness: number, temperature: number): void {
  const sightMultiplier = brightness < NIGHT_BRIGHTNESS ? NIGHT_SIGHT_FACTOR : 1;
  const isCold = temperature < COLD_TEMPERATURE;
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] === Species.Grass) continue;
    world.sight[entity] = world.baseSight[entity] * sightMultiplier;
    world.speed[entity] = world.baseSpeed[entity] * (isCold ? COLD_SPEED_FACTOR : 1);
    world.metabolismMultiplier[entity] = isCold ? COLD_METABOLISM_FACTOR : 1;
  }
}

export function movementSystem(world: World, terrain: TerrainGrid, deltaSeconds: number, width: number, height: number): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] === Species.Grass) continue;
    const multiplier = terrain.speedMultiplier(world.x[entity], world.y[entity]);
    world.x[entity] += world.velocityX[entity] * deltaSeconds * multiplier;
    world.y[entity] += world.velocityY[entity] * deltaSeconds * multiplier;
    if (terrain.isWall(world.x[entity], world.y[entity])) { world.x[entity] -= world.velocityX[entity] * deltaSeconds; world.y[entity] -= world.velocityY[entity] * deltaSeconds; world.velocityX[entity] *= -1; world.velocityY[entity] *= -1; }
    if (world.x[entity] <= 0 || world.x[entity] >= width) { world.x[entity] = Math.max(0, Math.min(width, world.x[entity])); world.velocityX[entity] *= -1; }
    if (world.y[entity] <= 0 || world.y[entity] >= height) { world.y[entity] = Math.max(0, Math.min(height, world.y[entity])); world.velocityY[entity] *= -1; }
  }
}

export function interactionSystem(world: World, terrain: TerrainGrid, config: SimulationConfig, onEvent?: SimulationEventHandler): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    const kind = world.species[entity];
    if (kind === Species.Herbivore) {
      const grass = nearest(world, entity, Species.Grass, CONTACT_DISTANCE);
      if (grass >= 0) { world.energy[entity] += GRASS_ENERGY; terrain.addGrazing(world.x[entity], world.y[entity]); world.queueRemove(grass); }
      if (world.energy[entity] > config.splitEnergy) {
        world.energy[entity] = ENERGY_AFTER_SPLIT;
        const mutationFactor = MUTATION_MIN_FACTOR + Math.random() * MUTATION_FACTOR_RANGE;
        world.queueSpawn(Species.Herbivore, world.x[entity] + CONTACT_DISTANCE - 1, world.y[entity] + CONTACT_DISTANCE - 1, ENERGY_AFTER_SPLIT, world.speed[entity] * mutationFactor, config.herbivoreSight * mutationFactor);
        onEvent?.({ type: 'split', x: world.x[entity], y: world.y[entity] });
      }
    } else if (kind === Species.Carnivore) {
      const prey = nearest(world, entity, Species.Herbivore, CONTACT_DISTANCE);
      if (prey >= 0) {
        world.energy[entity] += CARNIVORE_ENERGY_GAIN;
        world.queueDeath(prey, DECOMPOSITION_TIME, NUTRIENT_RESIDUAL_TIME);
        terrain.addPredation(world.x[entity], world.y[entity]);
        onEvent?.({ type: 'predation', x: world.x[entity], y: world.y[entity] });
      }
      if (world.energy[entity] > config.splitEnergy) {
        world.energy[entity] = ENERGY_AFTER_SPLIT;
        const mutationFactor = MUTATION_MIN_FACTOR + Math.random() * MUTATION_FACTOR_RANGE;
        world.queueSpawn(Species.Carnivore, world.x[entity] + CONTACT_DISTANCE - 1, world.y[entity] + CONTACT_DISTANCE - 1, ENERGY_AFTER_SPLIT, world.speed[entity] * mutationFactor, CARNIVORE_SIGHT * mutationFactor);
        onEvent?.({ type: 'split', x: world.x[entity], y: world.y[entity] });
      }
    }
  }
}

export function lifecycleSystem(world: World, elapsed: number, deltaSeconds: number, config: SimulationConfig): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0) continue;
    if (world.species[entity] === Species.Grass) { if (elapsed - world.bornAt[entity] >= GRASS_LIFETIME) world.queueRemove(entity); }
    else {
      const baseMetabolism = world.species[entity] === Species.Herbivore ? HERBIVORE_METABOLISM : config.carnivoreMetabolism;
      const speedFactor = world.species[entity] === Species.Herbivore ? world.speed[entity] / HERBIVORE_BASE_SPEED : 1;
      world.energy[entity] -= baseMetabolism * speedFactor * world.metabolismMultiplier[entity] * deltaSeconds;
        if (world.energy[entity] <= 0) {
          world.queueDeath(entity, DECOMPOSITION_TIME, NUTRIENT_RESIDUAL_TIME);
        } else {
          world.wasteCooldown[entity] -= deltaSeconds;
          if (world.wasteCooldown[entity] <= 0) {
            world.queueWaste(entity, WASTE_DECOMPOSITION_TIME, WASTE_RESIDUAL_TIME, WASTE_NUTRIENT);
            world.wasteCooldown[entity] = WASTE_INTERVAL;
          }
        }
    }
  }
}

export function decompositionSystem(world: World, grid: NutrientGrid, terrain: TerrainGrid, deltaSeconds: number): void {
  let artifact = 0;
  while (artifact < world.artifactCount) {
    if (world.artifactRemaining[artifact] > 0) {
      world.artifactRemaining[artifact] -= deltaSeconds;
      if (world.artifactRemaining[artifact] <= 0) {
          grid.add(world.artifactX[artifact], world.artifactY[artifact], world.artifactNutrient[artifact]);
        terrain.addDecomposition(world.artifactX[artifact], world.artifactY[artifact]);
        world.artifactRemaining[artifact] = -1;
      }
    } else {
      world.artifactResidual[artifact] -= deltaSeconds;
    }
    if (world.artifactResidual[artifact] <= 0) {
      const last = world.artifactCount - 1;
      world.artifactX[artifact] = world.artifactX[last];
      world.artifactY[artifact] = world.artifactY[last];
      world.artifactRemaining[artifact] = world.artifactRemaining[last];
      world.artifactResidual[artifact] = world.artifactResidual[last];
      world.artifactCount -= 1;
    } else artifact += 1;
  }
}

export interface DisasterState { breedingRemaining: number; meteorTriggered: boolean; floodTriggered: boolean; }

export function terrainSystem(terrain: TerrainGrid, onEvent?: SimulationEventHandler): void {
  terrain.evaluate((index, kind) => {
    const column = index % terrain.columns;
    const row = Math.floor(index / terrain.columns);
    onEvent?.({ type: 'terrain-change', terrain: kind, x: column * TERRAIN_CELL_SIZE + 12, y: row * TERRAIN_CELL_SIZE + 12 });
  });
}

export function disasterSystem(world: World, terrain: TerrainGrid, state: DisasterState, width: number, height: number, config: Pick<SimulationConfig, 'carnivoreSpeed'>, onEvent?: SimulationEventHandler): void {
  const herbivores = world.count(Species.Herbivore);
  if (world.count(Species.Carnivore) === 0 && herbivores > CARNIVORE_REPLENISH_HERBIVORE_THRESHOLD) {
    world.queueSpawn(Species.Carnivore, width - 1, height / 2, 100, config.carnivoreSpeed, CARNIVORE_SIGHT);
  }
  if (herbivores >= HERBIVORE_BREEDING_THRESHOLD && state.breedingRemaining <= 0) { state.breedingRemaining = BREEDING_MODE_DURATION; onEvent?.({ type: 'breeding-mode', x: width / 2, y: height / 2 }); }
  if (state.breedingRemaining > 0) state.breedingRemaining -= FIXED_STEP;
  if (world.activeCount >= POPULATION_METEOR_THRESHOLD && !state.meteorTriggered) {
    state.meteorTriggered = true;
    const x = Math.random() * width;
    const y = Math.random() * height;
    terrain.setCrater(x, y);
    for (let entity = 0; entity < MAX_ENTITIES; entity += 1) if ((world.flags[entity] & EntityFlags.Alive) !== 0 && (world.x[entity] - x) ** 2 + (world.y[entity] - y) ** 2 < CRATER_RADIUS ** 2) world.queueDeath(entity, DECOMPOSITION_TIME, NUTRIENT_RESIDUAL_TIME);
    onEvent?.({ type: 'meteor', x, y });
  }
  if (terrain.wetlandArea() >= FLOOD_WETLAND_THRESHOLD && !state.floodTriggered) { state.floodTriggered = true; terrain.startFlood(); floodSystem(world, width, height); onEvent?.({ type: 'flood', x: width / 2, y: 0 }); }
}

function floodSystem(world: World, width: number, height: number): void {
  for (let entity = 0; entity < MAX_ENTITIES; entity += 1) if ((world.flags[entity] & EntityFlags.Alive) !== 0) { world.x[entity] = Math.random() * width; world.y[entity] = Math.random() * height; world.velocityX[entity] *= -1; world.velocityY[entity] *= -1; }
  for (let artifact = 0; artifact < world.artifactCount; artifact += 1) { world.artifactX[artifact] = Math.random() * width; world.artifactY[artifact] = Math.random() * height; }
}
