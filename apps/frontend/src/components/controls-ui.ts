import type { SimulationCommand } from '../../../../packages/shared-types/src/api';
import { Species } from '../../../../packages/shared-types/src/ecs';

type AdjustableConfigKey = Extract<SimulationCommand, { type: 'update-config' }>['key'];

interface RangeControlDefinition {
  id: string;
  key: AdjustableConfigKey;
  unit: string;
}

const RANGE_CONTROLS: readonly RangeControlDefinition[] = [
  { id: 'grass-interval', key: 'grassSpawnInterval', unit: '秒' },
  { id: 'grass-limit', key: 'maxGrass', unit: '体' },
  { id: 'herbivore-sight', key: 'herbivoreSight', unit: 'px' },
  { id: 'split-energy', key: 'splitEnergy', unit: '' },
  { id: 'carnivore-speed', key: 'carnivoreSpeed', unit: 'px/s' },
  { id: 'carnivore-metabolism', key: 'carnivoreMetabolism', unit: '/s' },
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

    const update = (): void => {
      output.textContent = `${input.value}${definition.unit}`;
      this.send({ type: 'update-config', key: definition.key, value: Number(input.value) });
    };

    input.addEventListener('input', update);
    update();
  }

}