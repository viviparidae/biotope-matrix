export interface SerializedEntityState {
  id: number;
  species: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  size: number;
  shape: number;
  alive: number;
}

const ENTITY_BUFFER_LENGTH = 10;

export function encodeEntityBuffer(state: SerializedEntityState): ArrayBuffer {
  const values = new Float32Array(ENTITY_BUFFER_LENGTH);
  values[0] = state.id;
  values[1] = state.species;
  values[2] = state.x;
  values[3] = state.y;
  values[4] = state.vx;
  values[5] = state.vy;
  values[6] = state.energy;
  values[7] = state.size;
  values[8] = state.shape;
  values[9] = state.alive;
  return values.buffer;
}

export function decodeEntityBuffer(buffer: ArrayBuffer): SerializedEntityState {
  const values = new Float32Array(buffer);
  return {
    id: values[0],
    species: values[1],
    x: values[2],
    y: values[3],
    vx: values[4],
    vy: values[5],
    energy: values[6],
    size: values[7],
    shape: values[8],
    alive: values[9],
  };
}
