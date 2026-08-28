import { EntityFlags, MAX_ENTITIES, Species } from '../../../../packages/shared-types/src/ecs';
import type { SimulationSnapshot } from '../../../../packages/shared-types/src/api';

export function drawSystem(snapshot: SimulationSnapshot, context: CanvasRenderingContext2D): void {
	context.clearRect(0, 0, context.canvas.width, context.canvas.height);
	const cellSize = 24;
	for (let row = 0; row < snapshot.terrain.rows; row += 1) for (let column = 0; column < snapshot.terrain.columns; column += 1) {
		const kind = snapshot.terrain.kinds[row * snapshot.terrain.columns + column];
		context.fillStyle = kind === 1 ? '#b98b54' : kind === 2 ? '#2f7f83' : kind === 3 ? '#6b7280' : kind === 4 ? '#342f38' : '#111827';
		context.fillRect(column * cellSize, row * cellSize, cellSize, cellSize);
	}
	if (snapshot.terrain.waterFlow >= 0) {
		context.fillStyle = '#67e8f9';
		for (let column = 0; column < snapshot.terrain.columns; column += 1) context.fillRect(column * cellSize, Math.floor(snapshot.terrain.waterFlow), cellSize, 2);
	}
	for (let artifact = 0; artifact < snapshot.artifacts.x.length; artifact += 1) {
		const decomposing = snapshot.artifacts.remaining[artifact] > 0;
		context.fillStyle = decomposing ? '#58483d' : '#7a9b55';
		context.fillRect(Math.floor(snapshot.artifacts.x[artifact]), Math.floor(snapshot.artifacts.y[artifact]), 3, 3);
		if (!decomposing) {
			context.fillStyle = `rgba(150, 190, 92, ${Math.min(0.35, snapshot.artifacts.residual[artifact] / 50)})`;
			context.fillRect(Math.floor(snapshot.artifacts.x[artifact]) - 3, Math.floor(snapshot.artifacts.y[artifact]) - 3, 9, 9);
		}
	}
	for (let entity = 0; entity < Math.min(MAX_ENTITIES, snapshot.entities.flags.length); entity += 1) {
		if ((snapshot.entities.flags[entity] & EntityFlags.Alive) === 0) continue;
		const kind = snapshot.entities.species[entity];
		context.fillStyle = kind === Species.Grass ? '#65d66f' : kind === Species.Herbivore ? '#dbeafe' : '#ef4444';
		const size = kind === Species.Grass ? 1 : kind === Species.Herbivore ? 2 : 3;
		context.fillRect(Math.floor(snapshot.entities.x[entity]), Math.floor(snapshot.entities.y[entity]), size, size);
	}
	context.fillStyle = '#8fba62';
	for (let index = 0; index < snapshot.nutrient.values.length; index += 1) {
		if (snapshot.nutrient.values[index] > 0) context.fillRect((index % snapshot.nutrient.columns) * cellSize, Math.floor(index / snapshot.nutrient.columns) * cellSize, 1, 1);
	}
}