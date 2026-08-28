export const MAX_ENTITIES = 512;
export const FIXED_STEP = 1 / 60;
export const GRASS_LIFETIME = 30;
export const GRASS_SPAWN_INTERVAL = 1;
export const HERBIVORE_SIGHT = 5;
export const CARNIVORE_SIGHT = 100;
export const SPLIT_ENERGY = 150;
export const ENERGY_AFTER_SPLIT = 75;

export const enum Species {
  None = 0,
  Grass = 1,
  Herbivore = 2,
  Carnivore = 3,
}

export const enum EntityFlags {
  Alive = 1,
  PendingSpawn = 2,
  PendingRemoval = 4,
}

export interface SimulationConfig {
  readonly width: number;
  readonly height: number;
  readonly initialGrass: number;
  readonly initialHerbivores: number;
  readonly initialCarnivores: number;
  grassSpawnInterval: number;
  maxGrass: number;
  herbivoreSight: number;
  splitEnergy: number;
  carnivoreSpeed: number;
  carnivoreMetabolism: number;
}

export type SimulationEvent =
  | { type: 'grass-spawn'; x: number; y: number }
  | { type: 'predation'; x: number; y: number }
  | { type: 'split'; x: number; y: number };

export type SimulationEventHandler = (event: SimulationEvent) => void;