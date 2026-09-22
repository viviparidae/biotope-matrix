import type { SimulationConfig, SimulationEvent, Species } from './ecs';

export interface SimulationSnapshot {
  readonly simulationId: string;
  readonly sequence: number;
  readonly tick: number;
  readonly width: number;
  readonly height: number;
  readonly entities: {
    readonly flags: Uint8Array;
    readonly species: Uint8Array;
    readonly x: Float32Array;
    readonly y: Float32Array;
  };
  readonly artifacts: { readonly x: Float32Array; readonly y: Float32Array; readonly remaining: Float32Array; readonly residual: Float32Array };
  readonly terrain: { readonly columns: number; readonly rows: number; readonly kinds: Uint8Array; readonly waterFlow: number };
  readonly nutrient: { readonly columns: number; readonly rows: number; readonly values: Uint8Array };
  readonly counts: { readonly grass: number; readonly herbivores: number; readonly carnivores: number };
  readonly config: SimulationConfig;
}

export type SimulationCommand =
  | { readonly type: 'reset' }
  | { readonly type: 'spawn'; readonly species: Species; readonly count: number }
  | { readonly type: 'update-config'; readonly key: keyof Pick<SimulationConfig, 'grassSpawnInterval' | 'maxGrass' | 'herbivoreSight' | 'splitEnergy' | 'carnivoreSpeed' | 'carnivoreMetabolism'>; readonly value: number };

export interface ClientMessage {
  readonly type: 'subscribe' | 'command';
  readonly simulationId: string;
  readonly lastSequence?: number;
  readonly requestId?: string;
  readonly command?: SimulationCommand;
}

export interface ServerSnapshotMessage { readonly type: 'snapshot'; readonly snapshot: SimulationSnapshot; readonly events: SimulationEvent[]; }
export interface ServerAckMessage { readonly type: 'ack'; readonly requestId: string; }
export type ServerMessage = ServerSnapshotMessage | ServerAckMessage;