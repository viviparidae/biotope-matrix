import { SimulationEvent } from './types';

const AMBIENT_UPDATE_INTERVAL = 0.5;
const MAX_AMBIENT_GAIN = 0.035;

export class AudioManager {
  private context: AudioContext | undefined;
  private masterGain: GainNode | undefined;
  private ambientGain: GainNode | undefined;
  private ambientOscillators: OscillatorNode[] = [];
  private enabled = false;
  private lastAmbientUpdate = -Infinity;

  constructor(private readonly width: number) {}

  activate(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.18;
      this.masterGain.connect(this.context.destination);
      this.ambientGain = this.context.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientGain.connect(this.masterGain);
      this.ambientOscillators = [261.63, 329.63, 392].map((frequency) => {
        const oscillator = this.context!.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(this.ambientGain!);
        oscillator.start();
        return oscillator;
      });
    }
    if (this.context.state === 'suspended') void this.context.resume();
    this.enabled = true;
    this.updateAmbient(0, 0, 0, true);
  }

  toggle(): boolean {
    if (!this.enabled) this.activate();
    else this.enabled = false;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.enabled ? 0.18 : 0, this.context!.currentTime, 0.04);
    return this.enabled;
  }

  handleEvent(event: SimulationEvent): void {
    if (!this.enabled || !this.context || !this.masterGain) return;
    if (event.type === 'predation') this.playTone(880, 0.12, 'square', event.x);
    if (event.type === 'split') this.playTone(523.25, 0.16, 'sine', event.x);
    if (event.type === 'grass-spawn') this.playTone(220, 0.05, 'sine', event.x);
  }

  updateAmbient(grass: number, herbivores: number, carnivores: number, force = false): void {
    if (!this.enabled || !this.context || !this.ambientGain) return;
    const now = this.context.currentTime;
    if (!force && now - this.lastAmbientUpdate < AMBIENT_UPDATE_INTERVAL) return;
    this.lastAmbientUpdate = now;
    const population = grass + herbivores + carnivores;
    const tension = Math.min(1, carnivores / Math.max(1, herbivores) * 0.35 + Math.max(0, population - 90) / 180);
    const root = 196 + tension * 70;
    const frequencies = [root, root * (tension > 0.65 ? 1.42 : 1.5), root * 1.25];
    for (let index = 0; index < this.ambientOscillators.length; index += 1) {
      this.ambientOscillators[index].frequency.setTargetAtTime(frequencies[index], now, 0.3);
    }
    this.ambientGain.gain.setTargetAtTime(MAX_AMBIENT_GAIN * (0.65 + tension * 0.35), now, 0.3);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, x: number): void {
    const oscillator = this.context!.createOscillator();
    const gain = this.context!.createGain();
    const panner = this.context!.createStereoPanner();
    const start = this.context!.currentTime;
    const pan = Math.max(-1, Math.min(1, x / this.width * 2 - 1));
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.setValueAtTime(pan, start);
    oscillator.connect(gain).connect(panner).connect(this.masterGain!);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}