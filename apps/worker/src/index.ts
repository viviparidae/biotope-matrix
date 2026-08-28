import { WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '../../../packages/shared-types/src/api';
import { SimulationEngine } from './engine/simulation-engine';

const port = Number(process.env.PORT ?? 8787);
const engine = new SimulationEngine('default', 960, 540);
const clients = new Set<import('ws').WebSocket>();
const server = new WebSocketServer({ port });
server.on('error', (error: NodeJS.ErrnoException) => {
	if (error.code === 'EADDRINUSE') {
		console.error(`Simulation worker port ${port} is already in use. Stop the existing worker before starting another one.`);
		return;
	}
	console.error(error);
});

server.on('connection', (client) => {
	clients.add(client);
	client.on('close', () => clients.delete(client));
	client.on('message', (raw) => {
		const message = JSON.parse(raw.toString()) as ClientMessage;
		if (message.type === 'command' && message.command) {
			engine.apply(message.command);
			if (message.requestId) client.send(JSON.stringify({ type: 'ack', requestId: message.requestId } satisfies ServerMessage));
		}
		if (message.type === 'subscribe') client.send(JSON.stringify({ type: 'snapshot', snapshot: engine.tick().snapshot, events: [] } satisfies ServerMessage));
	});
});

setInterval(() => {
	const result = engine.tick();
	const message: ServerMessage = { type: 'snapshot', snapshot: result.snapshot, events: result.events };
	const serialized = JSON.stringify(message);
	for (const client of clients) if (client.readyState === 1) client.send(serialized);
}, 1000 / 60);

console.log(`Simulation worker listening on ws://localhost:${port}`);