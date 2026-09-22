import type { SimulationCommand } from '../../../../packages/shared-types/src/api';
import { Species } from '../../../../packages/shared-types/src/ecs';

type AdjustableConfigKey = Extract<SimulationCommand, { type: 'update-config' }>['key'];

interface RangeControlDefinition {
  id: string;
  key: AdjustableConfigKey;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

const RANGE_CONTROLS: readonly RangeControlDefinition[] = [
  { id: 'grass-interval', key: 'grassSpawnInterval', unit: '秒', min: 0.1, max: 5, step: 0.1, defaultValue: 0.5 },
  { id: 'grass-limit', key: 'maxGrass', unit: '体', min: 10, max: 2000, step: 10, defaultValue: 900 },
  { id: 'herbivore-sight', key: 'herbivoreSight', unit: 'px', min: 1, max: 150, step: 1, defaultValue: 12 },
  { id: 'split-energy', key: 'splitEnergy', unit: '', min: 50, max: 300, step: 5, defaultValue: 180 },
  { id: 'carnivore-speed', key: 'carnivoreSpeed', unit: 'px/s', min: 1, max: 60, step: 1, defaultValue: 16 },
  { id: 'carnivore-metabolism', key: 'carnivoreMetabolism', unit: '/s', min: 0.1, max: 10, step: 0.1, defaultValue: 1.8 },
];

export class ControlsUI {
  constructor(private readonly root: HTMLElement, private readonly send: (command: SimulationCommand) => void) {
    RANGE_CONTROLS.forEach((definition) => this.bindRange(definition));
    this.root.querySelector('#reset')?.addEventListener('click', () => this.send({ type: 'reset' }));
    this.root.querySelector('#add-herbivores')?.addEventListener('click', () => this.send({ type: 'spawn', species: Species.Herbivore, count: 10 }));
    this.root.querySelector('#add-carnivore')?.addEventListener('click', () => this.send({ type: 'spawn', species: Species.Carnivore, count: 1 }));
  }

  private bindRange(definition: RangeControlDefinition): void {
    const input = this.root.querySelector<HTMLInputElement>(`#${definition.id}`);
    const output = this.root.querySelector<HTMLOutputElement>(`#${definition.id}-value`);
    if (!input || !output) return;

    input.min = String(definition.min);
    input.max = String(definition.max);
    input.step = String(definition.step);
    input.value = String(definition.defaultValue);

    const update = (): void => {
      const value = Number(input.value);
      output.textContent = `${value}${definition.unit}`;
      this.send({ type: 'update-config', key: definition.key, value });
    };

    input.addEventListener('input', update);
    update();
  }

}