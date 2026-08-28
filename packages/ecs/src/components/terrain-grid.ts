export const TERRAIN_CELL_SIZE = 24;
const MAX_PRESSURE = 255;

export const enum TerrainKind {
  Plain = 0,
  Desert = 1,
  Wetland = 2,
  Mountain = 3,
  Crater = 4,
}

export class TerrainGrid {
  readonly columns: number;
  readonly rows: number;
  readonly kinds: Uint8Array;
  waterFlow = -1;
  private readonly grazingPressure: Uint8Array;
  private readonly decompositionPressure: Uint8Array;
  private readonly predationPressure: Uint8Array;

  constructor(width: number, height: number) {
    this.columns = Math.max(1, Math.ceil(width / TERRAIN_CELL_SIZE));
    this.rows = Math.max(1, Math.ceil(height / TERRAIN_CELL_SIZE));
    const size = this.columns * this.rows;
    this.kinds = new Uint8Array(size);
    this.grazingPressure = new Uint8Array(size);
    this.decompositionPressure = new Uint8Array(size);
    this.predationPressure = new Uint8Array(size);
    this.waterFlow = 0;
  }

  kindAt(x: number, y: number): TerrainKind { return this.kinds[this.index(x, y)] as TerrainKind; }
  isWall(x: number, y: number): boolean { const kind = this.kindAt(x, y); return kind === TerrainKind.Mountain || kind === TerrainKind.Crater; }
  grassMultiplier(x: number, y: number): number { return this.kindAt(x, y) === TerrainKind.Wetland ? 10 : 1; }
  speedMultiplier(x: number, y: number): number { return this.kindAt(x, y) === TerrainKind.Desert ? 0.5 : 1; }
  wetlandArea(): number {
    let total = 0;
    for (let index = 0; index < this.kinds.length; index += 1) if (this.kinds[index] === TerrainKind.Wetland) total += 1;
    return total;
  }

  addGrazing(x: number, y: number): void { this.addPressure(this.grazingPressure, x, y, 36); }
  addDecomposition(x: number, y: number): void { this.addPressure(this.decompositionPressure, x, y, 22); }
  addPredation(x: number, y: number): void { this.addPressure(this.predationPressure, x, y, 45); }

  evaluate(onChange?: (index: number, kind: TerrainKind) => void): void {
    for (let index = 0; index < this.kinds.length; index += 1) {
      const previousKind = this.kinds[index] as TerrainKind;
      if (this.kinds[index] === TerrainKind.Plain) {
        if (this.grazingPressure[index] >= 180) this.kinds[index] = TerrainKind.Desert;
        else if (this.decompositionPressure[index] >= 180) this.kinds[index] = TerrainKind.Wetland;
        else if (this.predationPressure[index] >= 210) this.kinds[index] = TerrainKind.Mountain;
      }
      if (this.kinds[index] !== previousKind) onChange?.(index, this.kinds[index] as TerrainKind);
      this.grazingPressure[index] = Math.max(0, this.grazingPressure[index] - 1);
      this.decompositionPressure[index] = Math.max(0, this.decompositionPressure[index] - 1);
      this.predationPressure[index] = Math.max(0, this.predationPressure[index] - 1);
    }
  }

  setCrater(x: number, y: number, radius = 22): void {
    const radiusSquared = radius * radius;
    for (let row = 0; row < this.rows; row += 1) for (let column = 0; column < this.columns; column += 1) {
      const centerX = column * TERRAIN_CELL_SIZE + TERRAIN_CELL_SIZE / 2;
      const centerY = row * TERRAIN_CELL_SIZE + TERRAIN_CELL_SIZE / 2;
      if ((centerX - x) ** 2 + (centerY - y) ** 2 <= radiusSquared) this.kinds[row * this.columns + column] = TerrainKind.Crater;
    }
  }

  clear(): void { this.kinds.fill(TerrainKind.Plain); this.grazingPressure.fill(0); this.decompositionPressure.fill(0); this.predationPressure.fill(0); this.waterFlow = -1; }

  startFlood(): void { this.waterFlow = 0; }
  advanceFlood(deltaSeconds: number, height: number): void { if (this.waterFlow >= 0) { this.waterFlow += deltaSeconds * 260; if (this.waterFlow > height) this.waterFlow = -1; } }

  private addPressure(values: Uint8Array, x: number, y: number, amount: number): void {
    const index = this.index(x, y);
    values[index] = Math.min(MAX_PRESSURE, values[index] + amount);
  }

  private index(x: number, y: number): number {
    const column = Math.max(0, Math.min(this.columns - 1, Math.floor(x / TERRAIN_CELL_SIZE)));
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor(y / TERRAIN_CELL_SIZE)));
    return row * this.columns + column;
  }
}