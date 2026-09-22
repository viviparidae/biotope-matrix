import { EntityFlags, MAX_ENTITIES, Species } from '../../../../packages/shared-types/src/ecs';
import { TerrainKind, TERRAIN_CELL_SIZE } from '../../../../packages/ecs/src/components/terrain-grid';
import type { SimulationSnapshot } from '../../../../packages/shared-types/src/api';

const TERRAIN_COLORS: Record<TerrainKind, string> = {
	[TerrainKind.Plain]: '#111827',
	[TerrainKind.Desert]: '#b98b54',
	[TerrainKind.Wetland]: '#2f7f83',
	[TerrainKind.Mountain]: '#6b7280',
	[TerrainKind.Crater]: '#342f38',
};

const WATER_FLOW_COLOR = '#67e8f9';
const ARTIFACT_DECOMPOSING_COLOR = '#58483d';
const ARTIFACT_RESIDUAL_BASE_COLOR = '#7a9b55';
const NUTRIENT_COLOR = '#8fba62';

const SPECIES_CONFIG: Record<Species, { color: string; size: number }> = {
	[Species.None]: { color: 'transparent', size: 0 },
	[Species.Grass]: { color: '#65d66f', size: 1 },
	[Species.Herbivore]: { color: '#dbeafe', size: 2 },
	[Species.Carnivore]: { color: '#ef4444', size: 3 },
};

function renderTerrain(context: CanvasRenderingContext2D, terrain: SimulationSnapshot['terrain']): void {
	for (let row = 0; row < terrain.rows; row += 1) {
		for (let column = 0; column < terrain.columns; column += 1) {
			const kind = terrain.kinds[row * terrain.columns + column] as TerrainKind;
			context.fillStyle = TERRAIN_COLORS[kind] ?? TERRAIN_COLORS[TerrainKind.Plain];
			context.fillRect(column * TERRAIN_CELL_SIZE, row * TERRAIN_CELL_SIZE, TERRAIN_CELL_SIZE, TERRAIN_CELL_SIZE);
		}
	}
}

function renderWaterFlow(context: CanvasRenderingContext2D, terrain: SimulationSnapshot['terrain']): void {
	if (terrain.waterFlow < 0) return;
	context.fillStyle = WATER_FLOW_COLOR;
	const flowY = Math.floor(terrain.waterFlow);
	for (let column = 0; column < terrain.columns; column += 1) {
		context.fillRect(column * TERRAIN_CELL_SIZE, flowY, TERRAIN_CELL_SIZE, 2);
	}
}

function renderArtifacts(context: CanvasRenderingContext2D, artifacts: SimulationSnapshot['artifacts']): void {
	for (let artifact = 0; artifact < artifacts.x.length; artifact += 1) {
		const decomposing = artifacts.remaining[artifact] > 0;
		context.fillStyle = decomposing ? ARTIFACT_DECOMPOSING_COLOR : ARTIFACT_RESIDUAL_BASE_COLOR;
		context.fillRect(Math.floor(artifacts.x[artifact]), Math.floor(artifacts.y[artifact]), 3, 3);
		if (!decomposing) {
			const opacity = Math.min(0.35, artifacts.residual[artifact] / 50);
			context.fillStyle = `rgba(150, 190, 92, ${opacity})`;
			context.fillRect(Math.floor(artifacts.x[artifact]) - 3, Math.floor(artifacts.y[artifact]) - 3, 9, 9);
		}
	}
}

function renderEntities(context: CanvasRenderingContext2D, entities: SimulationSnapshot['entities']): void {
	const entityCount = Math.min(MAX_ENTITIES, entities.flags.length);
	for (let entity = 0; entity < entityCount; entity += 1) {
		if ((entities.flags[entity] & EntityFlags.Alive) === 0) continue;
		const kind = entities.species[entity] as Species;
		const config = SPECIES_CONFIG[kind];
		if (!config) continue;
		context.fillStyle = config.color;
		context.fillRect(Math.floor(entities.x[entity]), Math.floor(entities.y[entity]), config.size, config.size);
	}
}

function renderNutrients(context: CanvasRenderingContext2D, nutrient: SimulationSnapshot['nutrient']): void {
	context.fillStyle = NUTRIENT_COLOR;
	for (let index = 0; index < nutrient.values.length; index += 1) {
		if (nutrient.values[index] > 0) {
			const col = index % nutrient.columns;
			const row = Math.floor(index / nutrient.columns);
			context.fillRect(col * TERRAIN_CELL_SIZE, row * TERRAIN_CELL_SIZE, 1, 1);
		}
	}
}

export function drawSystem(snapshot: SimulationSnapshot, context: CanvasRenderingContext2D): void {
	context.clearRect(0, 0, context.canvas.width, context.canvas.height);
	renderTerrain(context, snapshot.terrain);
	renderWaterFlow(context, snapshot.terrain);
	renderArtifacts(context, snapshot.artifacts);
	renderEntities(context, snapshot.entities);
	renderNutrients(context, snapshot.nutrient);
}