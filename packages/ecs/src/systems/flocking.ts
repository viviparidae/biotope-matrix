import { EntityFlags, Species } from '../../../shared-types/src/ecs';
import { World } from '../entities/world';

const GRID_CELL_SIZE = 32;
const SEPARATION_RADIUS = 8;
const ALIGNMENT_WEIGHT = 0.35;
const COHESION_WEIGHT = 0.2;
const SEPARATION_WEIGHT = 0.8;

export function flockingSystem(world: World, width: number, height: number, cellSize = GRID_CELL_SIZE): void {
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const cells: number[][] = Array.from({ length: columns * rows }, () => []);
  for (let entity = 0; entity < world.flags.length; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] === Species.Grass) continue;
    const column = Math.min(columns - 1, Math.max(0, Math.floor(world.x[entity] / cellSize)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(world.y[entity] / cellSize)));
    cells[row * columns + column].push(entity);
  }
  for (let entity = 0; entity < world.flags.length; entity += 1) {
    if ((world.flags[entity] & EntityFlags.Alive) === 0 || world.species[entity] === Species.Grass) continue;
    const column = Math.min(columns - 1, Math.max(0, Math.floor(world.x[entity] / cellSize)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(world.y[entity] / cellSize)));
    let count = 0; let centerX = 0; let centerY = 0; let velocityX = 0; let velocityY = 0; let separationX = 0; let separationY = 0;
    for (let cellRow = Math.max(0, row - 1); cellRow <= Math.min(rows - 1, row + 1); cellRow += 1) for (let cellColumn = Math.max(0, column - 1); cellColumn <= Math.min(columns - 1, column + 1); cellColumn += 1) for (const neighbor of cells[cellRow * columns + cellColumn]) {
      if (neighbor === entity || world.species[neighbor] !== world.species[entity]) continue;
      const deltaX = world.x[neighbor] - world.x[entity]; const deltaY = world.y[neighbor] - world.y[entity]; const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance === 0 || distance > cellSize * 1.5) continue;
      count += 1; centerX += world.x[neighbor]; centerY += world.y[neighbor]; velocityX += world.velocityX[neighbor]; velocityY += world.velocityY[neighbor];
      if (distance < SEPARATION_RADIUS) { separationX -= deltaX / distance; separationY -= deltaY / distance; }
    }
    if (count > 0) {
      world.velocityX[entity] += (velocityX / count - world.velocityX[entity]) * ALIGNMENT_WEIGHT + (centerX / count - world.x[entity]) * COHESION_WEIGHT + separationX * SEPARATION_WEIGHT;
      world.velocityY[entity] += (velocityY / count - world.velocityY[entity]) * ALIGNMENT_WEIGHT + (centerY / count - world.y[entity]) * COHESION_WEIGHT + separationY * SEPARATION_WEIGHT;
    }
  }
}