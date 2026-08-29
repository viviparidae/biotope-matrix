export interface OverlayConfig {
  grid: boolean;
  vision: boolean;
  flock: boolean;
  predationRate: boolean;
}

export class DebugOverlay {
  private readonly context: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;

  constructor(context: CanvasRenderingContext2D, width: number, height: number) {
    this.context = context;
    this.width = width;
    this.height = height;
  }

  render(config: OverlayConfig, data: {
    gridSize?: number;
    flockVectors?: Array<{ x: number; y: number; dx: number; dy: number; color?: string }>;
    visionRings?: Array<{ x: number; y: number; radius: number; color?: string }>;
    predationRates?: Array<{ x: number; y: number; value: number; color?: string }>;
  }): void {
    if (config.grid && data.gridSize) {
      this.context.strokeStyle = 'rgba(120, 180, 255, 0.20)';
      this.context.lineWidth = 1;
      for (let x = 0; x <= this.width; x += data.gridSize) {
        this.context.beginPath();
        this.context.moveTo(x, 0);
        this.context.lineTo(x, this.height);
        this.context.stroke();
      }
      for (let y = 0; y <= this.height; y += data.gridSize) {
        this.context.beginPath();
        this.context.moveTo(0, y);
        this.context.lineTo(this.width, y);
        this.context.stroke();
      }
    }

    if (config.vision) {
      for (const ring of data.visionRings ?? []) {
        this.context.beginPath();
        this.context.strokeStyle = ring.color ?? 'rgba(145, 255, 170, 0.35)';
        this.context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        this.context.stroke();
      }
    }

    if (config.flock) {
      for (const vector of data.flockVectors ?? []) {
        this.context.beginPath();
        this.context.strokeStyle = vector.color ?? 'rgba(255, 220, 110, 0.8)';
        this.context.moveTo(vector.x, vector.y);
        this.context.lineTo(vector.x + vector.dx, vector.y + vector.dy);
        this.context.stroke();
      }
    }

    if (config.predationRate) {
      for (const item of data.predationRates ?? []) {
        const alpha = Math.min(1, item.value);
        this.context.fillStyle = item.color ?? `rgba(255, 82, 82, ${0.2 + alpha * 0.8})`;
        this.context.fillRect(item.x - 3, item.y - 3, 6, 6);
      }
    }
  }
}
