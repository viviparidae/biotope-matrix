import { BodyShape, CARNIVORE_ENERGY_GAIN, CONTACT_DISTANCE, DECOMPOSITION_TIME, EntityFlags, NUTRIENT_RESIDUAL_TIME, PREDATION_SIZE_RATIO, SHAPE_ATTACK_FACTOR, SHAPE_DEFENSE_FACTOR, STARVATION_ENERGY_THRESHOLD, Species, SimulationConfig } from '../../../shared-types/src/ecs';
import { TerrainGrid } from '../components/terrain-grid';
import { World } from '../entities/world';

export interface PredationOutcome { success: boolean; damage: number; knockback: number; }

export function calculatePredationOutcome(predatorSize: number, predatorAttack: number, predatorShape: BodyShape, preySize: number, preyDefense: number, preyShape: BodyShape, randomValue: number): PredationOutcome {
  if (predatorSize < preySize * PREDATION_SIZE_RATIO) return { success: false, damage: preyDefense, knockback: 1 };
  const attack = predatorAttack * (predatorShape === BodyShape.Spiky ? SHAPE_ATTACK_FACTOR : 1);
  const defense = preyDefense * (preyShape === BodyShape.Armored ? SHAPE_DEFENSE_FACTOR : 1);
  const successRate = attack >= defense ? 1 : Math.max(0, Math.min(1, attack / (attack + defense)));
  return { success: randomValue < successRate, damage: defense, knockback: preyShape === BodyShape.Spiky ? 2 : 0 };
}

function nearestTarget(world: World, predator: number, allowCannibalism: boolean): number {
  let target = -1;
  let nearestDistance = CONTACT_DISTANCE * CONTACT_DISTANCE;
  for (let candidate = 0; candidate < world.flags.length; candidate += 1) {
    if (candidate === predator || (world.flags[candidate] & EntityFlags.Alive) === 0) continue;
    const isTarget = world.species[candidate] === Species.Herbivore || (allowCannibalism && world.species[candidate] === Species.Carnivore && world.size[candidate] < world.size[predator]);
    if (!isTarget) continue;
    const distance = (world.x[candidate] - world.x[predator]) ** 2 + (world.y[candidate] - world.y[predator]) ** 2;
    if (distance < nearestDistance) { nearestDistance = distance; target = candidate; }
  }
  return target;
}

export function predationSystem(world: World, terrain: TerrainGrid, config: SimulationConfig, random = Math.random, onEvent?: (event: { type: 'predation'; x: number; y: number }) => void): void {
  for (let predator = 0; predator < world.flags.length; predator += 1) {
    if ((world.flags[predator] & EntityFlags.Alive) === 0 || world.species[predator] !== Species.Carnivore) continue;
    const prey = nearestTarget(world, predator, world.energy[predator] <= STARVATION_ENERGY_THRESHOLD);
    if (prey < 0) continue;
    const outcome = calculatePredationOutcome(world.size[predator], world.attack[predator], world.shape[predator], world.size[prey], world.defense[prey], world.shape[prey], random());
    if (!outcome.success) {
      world.energy[predator] = Math.max(0, world.energy[predator] - outcome.damage);
      world.velocityX[predator] = -world.velocityX[predator] * outcome.knockback;
      world.velocityY[predator] = -world.velocityY[predator] * outcome.knockback;
      continue;
    }
    world.energy[predator] += CARNIVORE_ENERGY_GAIN;
    world.queueDeath(prey, DECOMPOSITION_TIME, NUTRIENT_RESIDUAL_TIME);
    terrain.addPredation(world.x[predator], world.y[predator]);
    onEvent?.({ type: 'predation', x: world.x[predator], y: world.y[predator] });
  }
}