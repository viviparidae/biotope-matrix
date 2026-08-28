import { AudioManager } from './audio/audio-manager';
import { ControlsUI } from './components/controls-ui';
import { drawSystem } from './canvas/renderer';
import type { ServerMessage, SimulationCommand, SimulationSnapshot } from '../../../packages/shared-types/src/api';
import type { SimulationEvent } from '../../../packages/shared-types/src/ecs';

const canvas = document.querySelector<HTMLCanvasElement>('#biotope');
const status = document.querySelector<HTMLElement>('#status');
const controls = document.querySelector<HTMLElement>('#controls');
const audioButton = document.querySelector<HTMLButtonElement>('#audio-toggle');
if (!canvas || !status || !controls || !audioButton) throw new Error('Canvas initialization failed');
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D context is unavailable');
const statusElement = status;
const controlsElement = controls;
const renderingContext = context;
context.imageSmoothingEnabled = false;

const audio = new AudioManager(canvas.width);
let snapshot: SimulationSnapshot | undefined;
let socket: WebSocket | undefined;
let lastSequence = 0;
let lastFrame = performance.now();
let frames = 0;
let fps = 0;

function send(command: SimulationCommand): void {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'command', simulationId: 'default', requestId: crypto.randomUUID(), command }));
}

new ControlsUI(controlsElement, send);
document.addEventListener('pointerdown', () => audio.activate(), { once: true });
audioButton.addEventListener('click', () => { const enabled = audio.toggle(); audioButton.textContent = enabled ? '音響: ON' : '音響: OFF'; });

function connect(): void {
  statusElement.textContent = 'Worker接続中';
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}/simulation`);
  socket.addEventListener('open', () => socket?.send(JSON.stringify({ type: 'subscribe', simulationId: 'default', lastSequence })));
  socket.addEventListener('message', (message) => {
    const serverMessage = JSON.parse(message.data as string) as ServerMessage;
    if (serverMessage.type !== 'snapshot') return;
    snapshot = serverMessage.snapshot;
    lastSequence = snapshot.sequence;
    for (const event of serverMessage.events) audio.handleEvent(event as SimulationEvent);
    audio.updateAmbient(snapshot.counts.grass, snapshot.counts.herbivores, snapshot.counts.carnivores);
  });
  socket.addEventListener('close', () => { statusElement.textContent = 'サーバー接続待機中'; window.setTimeout(connect, 1000); });
  socket.addEventListener('error', () => { statusElement.textContent = 'Workerに接続できません'; });
}

function frame(time: number): void {
  if (snapshot) {
    drawSystem(snapshot, renderingContext);
    frames += 1;
    if (time - lastFrame > 250) {
      fps = frames * 1000 / (time - lastFrame);
      statusElement.textContent = `FPS ${fps.toFixed(0)}  |  草 ${snapshot.counts.grass}  草食 ${snapshot.counts.herbivores}  肉食 ${snapshot.counts.carnivores}  |  seq ${snapshot.sequence}`;
      frames = 0;
      lastFrame = time;
    }
  }
  requestAnimationFrame(frame);
}

connect();
requestAnimationFrame(frame);