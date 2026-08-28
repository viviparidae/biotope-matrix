import { World } from './ecs';
import { SimulationConfig, Species } from './types';

type AdjustableConfigKey = 'grassSpawnInterval' | 'maxGrass' | 'herbivoreSight' | 'splitEnergy' | 'carnivoreSpeed' | 'carnivoreMetabolism';

export class ControlsUI {
  constructor(private readonly root: HTMLElement, private readonly world: World, private readonly config: SimulationConfig) {
    this.bindRange('grass-interval', 'grassSpawnInterval', '秒');
    this.bindRange('grass-limit', 'maxGrass', '体');
    this.bindRange('herbivore-sight', 'herbivoreSight', 'px');
    this.bindRange('split-energy', 'splitEnergy', '');
    this.bindRange('carnivore-speed', 'carnivoreSpeed', 'px/s');
    this.bindRange('carnivore-metabolism', 'carnivoreMetabolism', '/s');
    this.root.querySelector('#reset')?.addEventListener('click', () => this.world.clear());
    this.root.querySelector('#add-herbivores')?.addEventListener('click', () => this.spawn(Species.Herbivore, 10));
    this.root.querySelector('#add-carnivore')?.addEventListener('click', () => this.spawn(Species.Carnivore, 1));
  }

  private bindRange(id: string, key: AdjustableConfigKey, unit: string): void {
    const input = this.root.querySelector<HTMLInputElement>(`#${id}`);
    const output = this.root.querySelector<HTMLOutputElement>(`#${id}-value`);
    if (!input || !output) return;
    const update = (): void => { this.config[key] = Number(input.value); output.value = `${input.value}${unit}`; };
    input.addEventListener('input', update);
    update();
  }

  private spawn(species: Species, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const speed = species === Species.Carnivore ? this.config.carnivoreSpeed : 22;
      const sight = species === Species.Herbivore ? this.config.herbivoreSight : 100;
      this.world.queueSpawn(species, Math.random() * this.config.width, Math.random() * this.config.height, 100, speed, sight);
    }
    this.world.commitCommands();
  }
}