export const NUTRIENT_CELL_SIZE = 24;
const MAX_NUTRIENT = 255;

export class NutrientGrid {
  readonly columns: number;
  readonly rows: number;
  get serializedValues(): number[] { return Array.from(this.values); }
  private readonly values: Uint8Array;

  constructor(width: number, height: number) {
    this.columns = Math.max(1, Math.ceil(width / NUTRIENT_CELL_SIZE));
    this.rows = Math.max(1, Math.ceil(height / NUTRIENT_CELL_SIZE));
    this.values = new Uint8Array(this.columns * this.rows);
  }

  sample(x: number, y: number): number {
    return this.values[this.index(x, y)];
  }

  add(x: number, y: number, amount: number): void {
    const index = this.index(x, y);
    this.values[index] = Math.min(MAX_NUTRIENT, this.values[index] + Math.max(0, amount));
  }

  consume(x: number, y: number, amount: number): void {
    const index = this.index(x, y);
    this.values[index] = Math.max(0, this.values[index] - Math.max(0, amount));
  }

  clear(): void { this.values.fill(0); }

  private index(x: number, y: number): number {
    const column = Math.max(0, Math.min(this.columns - 1, Math.floor(x / NUTRIENT_CELL_SIZE)));
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor(y / NUTRIENT_CELL_SIZE)));
    return row * this.columns + column;
  }
}