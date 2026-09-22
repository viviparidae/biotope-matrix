import type { SimulationCommand } from '../../../packages/shared-types/src/api';

export interface SocketLike {
  readyState: number;
  send(data: string): void;
}

export function createCommandQueue(defaultSimulationId = 'default') {
  const pendingCommands: SimulationCommand[] = [];

  const serializeCommand = (command: SimulationCommand): string => JSON.stringify({
    type: 'command',
    simulationId: defaultSimulationId,
    requestId: crypto.randomUUID(),
    command,
  });

  return {
    pendingCommands,
    send(command: SimulationCommand, socket?: SocketLike): void {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(serializeCommand(command));
        return;
      }
      pendingCommands.push(command);
    },
    flush(socket?: SocketLike): void {
      while (pendingCommands.length > 0 && socket?.readyState === WebSocket.OPEN) {
        const command = pendingCommands.shift();
        if (!command) continue;
        socket.send(serializeCommand(command));
      }
    },
  };
}
