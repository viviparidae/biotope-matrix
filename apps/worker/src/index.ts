import { WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage, SimulationSnapshot } from '../../../packages/shared-types/src/api';
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

function serializeSnapshot(snapshot: SimulationSnapshot): object {
	return {
		...snapshot,
		entities: {
			flags: Array.from(snapshot.entities.flags),
			species: Array.from(snapshot.entities.species),
			x: Array.from(snapshot.entities.x),
			y: Array.from(snapshot.entities.y),
		},
		artifacts: {
			x: Array.from(snapshot.artifacts.x),
			y: Array.from(snapshot.artifacts.y),
			remaining: Array.from(snapshot.artifacts.remaining),
			residual: Array.from(snapshot.artifacts.residual),
		},
		terrain: { ...snapshot.terrain, kinds: Array.from(snapshot.terrain.kinds) },
		nutrient: { ...snapshot.nutrient, values: Array.from(snapshot.nutrient.values) },
	};
}

server.on('connection', (client) => {
	clients.add(client);
	client.on('close', () => clients.delete(client));
	client.on('message', (raw) => {
		const message = JSON.parse(raw.toString()) as ClientMessage;
		if (message.type === 'command' && message.command) {
			engine.apply(message.command);
			if (message.requestId) client.send(JSON.stringify({ type: 'ack', requestId: message.requestId } satisfies ServerMessage));
		}
		if (message.type === 'subscribe') client.send(JSON.stringify({ type: 'snapshot', snapshot: serializeSnapshot(engine.tick().snapshot), events: [] }));
	});
});

setInterval(() => {
	const result = engine.tick();
	const message = { type: 'snapshot', snapshot: serializeSnapshot(result.snapshot), events: result.events };
	const serialized = JSON.stringify(message);
	for (const client of clients) if (client.readyState === 1) client.send(serialized);
}, 1000 / 60);

console.log(`Simulation worker listening on ws://localhost:${port}`);