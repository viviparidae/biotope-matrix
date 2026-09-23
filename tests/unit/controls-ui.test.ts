import { describe, expect, it, vi } from 'vitest';
import { ControlsUI } from '../../apps/frontend/src/components/controls-ui';
import { createCommandQueue } from '../../apps/frontend/src/simulation-client';
import { Species } from '../../packages/shared-types/src/ecs';

class FakeElement {
  public value = '';
  public min = '';
  public max = '';
  public step = '';
  public textContent = '';
  private listeners = new Map<string, Array<() => void>>();

  constructor(public readonly id: string) {}

  addEventListener(type: string, listener: () => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  dispatch(type: string): void {
    const bucket = this.listeners.get(type) ?? [];
    for (const listener of bucket) listener();
  }

  dispatchEvent(event: Event | { type: string }): void {
    this.dispatch((event as { type: string }).type);
  }
}

function createControlsRoot(): { root: HTMLElement; elements: Record<string, FakeElement> } {
  const elements: Record<string, FakeElement> = {};

  const ids = [
    'grass-interval',
    'grass-limit',
    'herbivore-sight',
    'split-energy',
    'carnivore-speed',
    'carnivore-metabolism',
    'grass-interval-value',
    'grass-limit-value',
    'herbivore-sight-value',
    'split-energy-value',
    'carnivore-speed-value',
    'carnivore-metabolism-value',
    'reset',
    'add-herbivores',
    'add-carnivore',
  ];

  for (const id of ids) {
    elements[id] = new FakeElement(id);
  }

  const root = {
    querySelector: (selector: string) => {
      if (!selector.startsWith('#')) return null;
      const id = selector.slice(1);
      return elements[id] ?? null;
    },
  } as unknown as HTMLElement;

  return { root, elements };
}

describe('UI 操作', () => {
  it('REQ-ARCH-001: 範囲スライダーの変更が設定更新として送信される', () => {
    // Arrange
    const { root, elements } = createControlsRoot();
    const send = vi.fn();
    new ControlsUI(root, send);

    // Act
    elements['grass-limit'].value = '120';
    elements['grass-limit'].dispatch('input');

    // Assert
    expect(send).toHaveBeenCalledWith({ type: 'update-config', key: 'maxGrass', value: 120 });
    expect(elements['grass-limit-value'].textContent).toBe('120体');
  });

  it('REQ-ARCH-002: 追加ボタンとリセットが対応するコマンドを送る', () => {
    // Arrange
    const { root } = createControlsRoot();
    const send = vi.fn();
    new ControlsUI(root, send);

    // Act
    (root.querySelector('#reset') as FakeElement | null)?.dispatchEvent({ type: 'click' } as Event);
    (root.querySelector('#add-herbivores') as FakeElement | null)?.dispatchEvent({ type: 'click' } as Event);
    (root.querySelector('#add-carnivore') as FakeElement | null)?.dispatchEvent({ type: 'click' } as Event);

    // Assert
    expect(send).toHaveBeenCalledWith({ type: 'reset' });
    expect(send).toHaveBeenCalledWith({ type: 'spawn', species: Species.Herbivore, count: 10 });
    expect(send).toHaveBeenCalledWith({ type: 'spawn', species: Species.Carnivore, count: 1 });
  });

  it('REQ-ARCH-001: 境界値のスライダー値でも設定更新が正しく送られる', () => {
    // Arrange
    const { root, elements } = createControlsRoot();
    const send = vi.fn();
    new ControlsUI(root, send);

    // Act
    elements['grass-limit'].value = '10';
    elements['grass-limit'].dispatch('input');
    elements['carnivore-metabolism'].value = '10';
    elements['carnivore-metabolism'].dispatch('input');

    // Assert
    expect(send).toHaveBeenCalledWith({ type: 'update-config', key: 'maxGrass', value: 10 });
    expect(elements['grass-limit-value'].textContent).toBe('10体');
    expect(send).toHaveBeenCalledWith({ type: 'update-config', key: 'carnivoreMetabolism', value: 10 });
    expect(elements['carnivore-metabolism-value'].textContent).toBe('10/s');
  });

  it('REQ-ARCH-001: WebSocket 未接続時でも送信要求をキューに保存して接続後に送る', () => {
    // Arrange
    const queue = createCommandQueue();
    const socket = { readyState: 0, send: vi.fn() } as unknown as WebSocket & { send: ReturnType<typeof vi.fn> };
    const openState = globalThis.WebSocket?.OPEN ?? 1;

    // Act
    queue.send({ type: 'update-config', key: 'maxGrass', value: 120 }, socket);
    queue.send({ type: 'spawn', species: Species.Herbivore, count: 10 }, socket);
    Object.defineProperty(socket, 'readyState', { value: openState, configurable: true });
    queue.flush(socket);

    // Assert
    expect(socket.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(socket.send.mock.calls[0][0]).command).toEqual({ type: 'update-config', key: 'maxGrass', value: 120 });
    expect(JSON.parse(socket.send.mock.calls[1][0]).command).toEqual({ type: 'spawn', species: Species.Herbivore, count: 10 });
  });

  it('REQ-ARCH-001: 連続する UI 操作がキュー順に保持される', () => {
    // Arrange
    const queue = createCommandQueue();
    const socket = { readyState: 0, send: vi.fn() } as unknown as WebSocket & { send: ReturnType<typeof vi.fn> };
    const openState = globalThis.WebSocket?.OPEN ?? 1;

    // Act
    queue.send({ type: 'update-config', key: 'grassSpawnInterval', value: 0.5 }, socket);
    queue.send({ type: 'update-config', key: 'maxGrass', value: 150 }, socket);
    queue.send({ type: 'spawn', species: Species.Carnivore, count: 1 }, socket);
    Object.defineProperty(socket, 'readyState', { value: openState, configurable: true });
    queue.flush(socket);

    // Assert
    expect(JSON.parse(socket.send.mock.calls[0][0]).command).toEqual({ type: 'update-config', key: 'grassSpawnInterval', value: 0.5 });
    expect(JSON.parse(socket.send.mock.calls[1][0]).command).toEqual({ type: 'update-config', key: 'maxGrass', value: 150 });
    expect(JSON.parse(socket.send.mock.calls[2][0]).command).toEqual({ type: 'spawn', species: Species.Carnivore, count: 1 });
  });
});
