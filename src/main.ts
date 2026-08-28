import { World } from './ecs';
import { behaviorSystem, drawSystem, interactionSystem, lifecycleSystem, movementSystem, seedWorld, spawnGrass } from './systems';
import { FIXED_STEP, SimulationConfig } from './types';
import { ControlsUI } from './ui';
import { AudioManager } from './audio';

const canvas = document.querySelector<HTMLCanvasElement>('#biotope');
const status = document.querySelector<HTMLElement>('#status');
const controls = document.querySelector<HTMLElement>('#controls');
const audioButton = document.querySelector<HTMLButtonElement>('#audio-toggle');
if (!canvas || !status || !controls || !audioButton) throw new Error('Canvas initialization failed');
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D context is unavailable');
const canvasElement = canvas;
const statusElement = status;
const renderingContext = context;
renderingContext.imageSmoothingEnabled = false;

const world = new World();
const config: SimulationConfig = { width: canvasElement.width, height: canvasElement.height, initialGrass: 80, initialHerbivores: 18, initialCarnivores: 3, grassSpawnInterval: 1, maxGrass: 100, herbivoreSight: 5, splitEnergy: 150, carnivoreSpeed: 18, carnivoreMetabolism: 3.4 };
const controlsUI = new ControlsUI(controls, world, config);
const audio = new AudioManager(canvasElement.width);
const handleSimulationEvent = (event: Parameters<AudioManager['handleEvent']>[0]): void => audio.handleEvent(event);
document.addEventListener('pointerdown', () => audio.activate(), { once: true });
audioButton.addEventListener('click', () => { const enabled = audio.toggle(); audioButton.textContent = enabled ? '音響: ON' : '音響: OFF'; });
seedWorld(world, config);
let previousTime = performance.now();
let accumulator = 0;
let elapsed = 0;
let lastStatusTime = 0;
let frameCount = 0;
let fps = 0;

function tick(): void {
  spawnGrass(world, elapsed, config, handleSimulationEvent);
  behaviorSystem(world, config);
  movementSystem(world, FIXED_STEP, config.width, config.height);
  interactionSystem(world, config, handleSimulationEvent);
  lifecycleSystem(world, elapsed, FIXED_STEP, config);
  world.commitCommands();
  elapsed += FIXED_STEP;
}

function frame(time: number): void {
  const delta = Math.min((time - previousTime) / 1000, 0.25);
  previousTime = time;
  accumulator += delta;
  while (accumulator >= FIXED_STEP) { tick(); accumulator -= FIXED_STEP; }
  drawSystem(world, renderingContext);
  frameCount += 1;
  if (time - lastStatusTime > 250) {
    fps = frameCount * 1000 / (time - lastStatusTime || 1);
    statusElement.textContent = `FPS ${fps.toFixed(0)}  |  草 ${world.count(1)}  草食 ${world.count(2)}  肉食 ${world.count(3)}`;
    audio.updateAmbient(world.count(1), world.count(2), world.count(3));
    frameCount = 0;
    lastStatusTime = time;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);