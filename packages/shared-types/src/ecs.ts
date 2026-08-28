export const MAX_ENTITIES = 512;
export const FIXED_STEP = 1 / 60;
export const GRASS_LIFETIME = 30;
export const GRASS_SPAWN_INTERVAL = 1;
export const HERBIVORE_SIGHT = 5;
export const HERBIVORE_BASE_SPEED = 22;
export const CARNIVORE_SIGHT = 100;
export const SPLIT_ENERGY = 150;
export const ENERGY_AFTER_SPLIT = 75;
export const CONTACT_DISTANCE = 3;
export const GRASS_ENERGY = 50;
export const HERBIVORE_METABOLISM = 2.2;
export const NIGHT_BRIGHTNESS = 0.25;
export const NIGHT_SIGHT_FACTOR = 0.5;
export const COLD_TEMPERATURE = 10;
export const COLD_SPEED_FACTOR = 0.7;
export const COLD_METABOLISM_FACTOR = 1.25;
export const CARNIVORE_ENERGY_GAIN = 100;
export const MUTATION_MIN_FACTOR = 0.9;
export const MUTATION_FACTOR_RANGE = 0.2;
export const CRATER_RADIUS = 70;
export const DECOMPOSITION_NUTRIENT = 90;
export const GRASS_NUTRIENT_CONSUMPTION = 7;
export const RANDOM_GRASS_NUTRIENT_CONSUMPTION = 2;
export const BREEDING_MODE_DURATION = 12;
export const MAX_ARTIFACTS = 128;
export const DECOMPOSITION_TIME = 12;
export const NUTRIENT_RESIDUAL_TIME = 18;
export const WASTE_DECOMPOSITION_TIME = 2;
export const WASTE_NUTRIENT = 8;
export const WASTE_RESIDUAL_TIME = 4;
export const WASTE_INTERVAL = 5;
export const CARNIVORE_REPLENISH_HERBIVORE_THRESHOLD = 30;
export const HERBIVORE_BREEDING_THRESHOLD = 50;
export const POPULATION_METEOR_THRESHOLD = 115;
export const FLOOD_WETLAND_THRESHOLD = 30;
export const MIN_BODY_SIZE = 0.5;
export const MAX_BODY_SIZE = 3;
export const PREDATION_SIZE_RATIO = 0.8;
export const STARVATION_ENERGY_THRESHOLD = 20;
export const SHAPE_ATTACK_FACTOR = 1.15;
export const SHAPE_DEFENSE_FACTOR = 1.25;

export const enum Species {
  None = 0,
  Grass = 1,
  Herbivore = 2,
  Carnivore = 3,
}

export const enum BodyShape {
  Standard = 0,
  Spiky = 1,
  Armored = 2,
  Streamlined = 3,
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
  brightness?: number;
  temperature?: number;
}

export type SimulationEvent =
  | { type: 'grass-spawn'; x: number; y: number }
  | { type: 'predation'; x: number; y: number }
  | { type: 'split'; x: number; y: number }
  | { type: 'terrain-change'; terrain: number; x: number; y: number }
  | { type: 'breeding-mode'; x: number; y: number }
  | { type: 'meteor'; x: number; y: number }
  | { type: 'flood'; x: number; y: number };

export type SimulationEventHandler = (event: SimulationEvent) => void;