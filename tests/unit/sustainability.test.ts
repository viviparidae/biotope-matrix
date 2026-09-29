import { describe, expect, it } from 'vitest';
import {
  calculateEnergyEfficiency,
  calculateExtinctionRate,
  calculatePopulationAmplitude,
  applySustainabilityPressure,
  buildRefugiumGuard,
  enforcePopulationBoundsSystem,
  ensureRefugiumGrowthSystem,
} from '../../src/systems/sustainabilitySystem';
import { World } from '../../packages/ecs/src/entities/world';
import { TerrainGrid } from '../../packages/ecs/src/components/terrain-grid';
import {
  HERBIVORE_MAX_POPULATION,
  HERBIVORE_MIN_POPULATION,
  CARNIVORE_MAX_POPULATION,
  CARNIVORE_MIN_POPULATION,
  REFUGIUM_MINIMUM_GRASS,
  Species,
} from '../../packages/shared-types/src/ecs';

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function makeHistory(
  herbivores: number,
  carnivores: number,
  grass: number,
  length = 10,
) {
  return Array.from({ length }, () => ({ herbivores, carnivores, grass }));
}

// ─── calculateExtinctionRate ─────────────────────────────────────────────────

describe('calculateExtinctionRate', () => {
  it('REQ-SUST-001: 空の履歴では絶滅率は 0 を返す（異常系: 空配列）', () => {
    // Arrange / Act
    const rate = calculateExtinctionRate([], 'herbivore');
    // Assert
    expect(rate).toBe(0);
  });

  it('REQ-SUST-001: 全期間で個体数 > 0 なら絶滅率は 0（境界値 N=1）', () => {
    // Arrange
    const history = makeHistory(1, 1, 10);
    // Act
    const rate = calculateExtinctionRate(history, 'herbivore');
    // Assert
    expect(rate).toBe(0);
  });

  it('REQ-SUST-001: 個体数が常に 0 なら絶滅率は 1.0（境界値 N=0, 最悪ケース）', () => {
    // Arrange
    const history = makeHistory(0, 0, 0);
    // Act
    const herbivorRate = calculateExtinctionRate(history, 'herbivore');
    const carnivoreRate = calculateExtinctionRate(history, 'carnivore');
    // Assert
    expect(herbivorRate).toBe(1.0);
    expect(carnivoreRate).toBe(1.0);
  });

  it('REQ-SUST-001: 5 件中 2 件が 0 なら絶滅率は 0.4（境界値 N-1=0, N=1）', () => {
    // Arrange
    const history = [
      { herbivores: 0, carnivores: 5, grass: 10 },
      { herbivores: 1, carnivores: 5, grass: 10 },
      { herbivores: 0, carnivores: 5, grass: 10 },
      { herbivores: 5, carnivores: 5, grass: 10 },
      { herbivores: 5, carnivores: 5, grass: 10 },
    ];
    // Act
    const rate = calculateExtinctionRate(history, 'herbivore');
    // Assert
    expect(rate).toBeCloseTo(0.4);
  });
});

// ─── calculatePopulationAmplitude ───────────────────────────────────────────

describe('calculatePopulationAmplitude', () => {
  it('REQ-SUST-001: 空の履歴では振幅は 0（異常系: 空配列）', () => {
    // Arrange / Act
    const amplitude = calculatePopulationAmplitude([], 'herbivore');
    // Assert
    expect(amplitude).toBe(0);
  });

  it('REQ-SUST-001: 最小値が 0 を含む場合は Infinity を返す（絶滅リスク検出）', () => {
    // Arrange
    const history = [
      { herbivores: 0, carnivores: 5, grass: 10 },
      { herbivores: 100, carnivores: 5, grass: 10 },
    ];
    // Act
    const amplitude = calculatePopulationAmplitude(history, 'herbivore');
    // Assert
    expect(amplitude).toBe(Number.POSITIVE_INFINITY);
  });

  it('REQ-SUST-001: 全期間で個体数が一定なら振幅は 1.0（境界値: 変動なし）', () => {
    // Arrange
    const history = makeHistory(50, 10, 100);
    // Act
    const amplitude = calculatePopulationAmplitude(history, 'herbivore');
    // Assert
    expect(amplitude).toBe(1.0);
  });

  it('REQ-SUST-001: min=10, max=50 の場合は振幅 5.0 を返す（境界値分析）', () => {
    // Arrange
    const history = [
      { herbivores: 10, carnivores: 5, grass: 10 },
      { herbivores: 50, carnivores: 5, grass: 10 },
      { herbivores: 30, carnivores: 5, grass: 10 },
    ];
    // Act
    const amplitude = calculatePopulationAmplitude(history, 'herbivore');
    // Assert
    expect(amplitude).toBe(5.0);
  });
});

// ─── calculateEnergyEfficiency ────────────────────────────────────────────────

describe('calculateEnergyEfficiency', () => {
  it('空の履歴では 0 を返す（異常系）', () => {
    // Arrange / Act / Assert
    expect(calculateEnergyEfficiency([])).toBe(0);
  });

  it('消費者が 0 のとき grass / 1 を返す（ゼロ除算ガード）', () => {
    // Arrange
    const history = [{ herbivores: 0, carnivores: 0, grass: 100 }];
    // Act
    const efficiency = calculateEnergyEfficiency(history);
    // Assert
    expect(efficiency).toBe(100 / 1); // grass / (0 + 1)
  });

  it('草食・肉食が多いほどエネルギー効率は低くなる（正常系）', () => {
    // Arrange
    const lowConsumer = makeHistory(1, 1, 100);
    const highConsumer = makeHistory(50, 50, 100);
    // Act
    const effLow = calculateEnergyEfficiency(lowConsumer);
    const effHigh = calculateEnergyEfficiency(highConsumer);
    // Assert
    expect(effLow).toBeGreaterThan(effHigh);
  });
});

// ─── applySustainabilityPressure ─────────────────────────────────────────────

describe('applySustainabilityPressure', () => {
  it('REQ-SUST-002: 草食個体数 N-1=19, N=20, N+1=21 での圧力変化（境界値分析）', () => {
    // Arrange
    const belowThreshold = applySustainabilityPressure({ herbivores: 19, carnivores: 5, grass: 30 });
    const atThreshold = applySustainabilityPressure({ herbivores: 20, carnivores: 5, grass: 30 });
    const aboveThreshold = applySustainabilityPressure({ herbivores: 21, carnivores: 5, grass: 30 });

    // Assert: 閾値以下では草食へのステルス強化が発動する
    expect(belowThreshold.herbivoreStealthBoost).toBeGreaterThan(0);
    expect(belowThreshold.predatorSightReduction).toBeGreaterThan(0);

    // 閾値（N=20）でも圧力は依然として正
    expect(atThreshold.herbivoreStealthBoost).toBeGreaterThanOrEqual(0);

    // 閾値超えでは草食リスクが低下し、圧力が弱まる傾向
    expect(aboveThreshold.herbivoreStealthBoost).toBeLessThan(belowThreshold.herbivoreStealthBoost);
  });

  it('REQ-SUST-002: 肉食が過剰（N=12+1=13）では捕食者圧力が増す（境界値）', () => {
    // Arrange
    const atCrowdingThreshold = applySustainabilityPressure({ herbivores: 50, carnivores: 12, grass: 50 });
    const overCrowding = applySustainabilityPressure({ herbivores: 50, carnivores: 13, grass: 50 });

    // Assert: 肉食過剰時に速度・視野の抑制が強まる
    expect(overCrowding.predatorSpeedReduction).toBeGreaterThanOrEqual(atCrowdingThreshold.predatorSpeedReduction);
  });

  it('REQ-SUST-002: 個体数が十分（草食 100、肉食 5）では圧力値が小さい（正常系）', () => {
    // Arrange
    const metrics = { herbivores: 100, carnivores: 5, grass: 200 };
    // Act
    const pressure = applySustainabilityPressure(metrics);
    // Assert
    expect(pressure.herbivoreStealthBoost).toBeLessThanOrEqual(0.1);
    expect(pressure.predatorSightReduction).toBeLessThanOrEqual(0.05);
  });
});

// ─── buildRefugiumGuard ───────────────────────────────────────────────────────

describe('buildRefugiumGuard', () => {
  it('REQ-SUST-002: 草食 N-1=19 で避難所が有効になる（境界値）', () => {
    // Arrange / Act
    const refuge = buildRefugiumGuard({ herbivores: 19, carnivores: 3, grass: 5 });
    // Assert
    expect(refuge.refugeActive).toBe(true);
  });

  it('REQ-SUST-002: 草食 N=20 でも避難所条件を満たす場合は有効（境界値）', () => {
    // Arrange: 草 25 以下 → 避難所条件に該当
    const refuge = buildRefugiumGuard({ herbivores: 20, carnivores: 3, grass: 25 });
    // Assert
    expect(refuge.refugeActive).toBe(true);
  });

  it('REQ-SUST-002: 十分な個体数では避難所は無効（正常系）', () => {
    // Arrange
    const refuge = buildRefugiumGuard({ herbivores: 100, carnivores: 5, grass: 200 });
    // Assert
    expect(refuge.refugeActive).toBe(false);
  });

  it('REQ-SUST-002: grassSpawnFloor は常に正の値（不変条件）', () => {
    // Arrange
    const extreme = buildRefugiumGuard({ herbivores: 0, carnivores: 0, grass: 0 });
    const normal = buildRefugiumGuard({ herbivores: 50, carnivores: 5, grass: 100 });
    // Assert
    expect(extreme.grassSpawnFloor).toBeGreaterThan(0);
    expect(normal.grassSpawnFloor).toBeGreaterThan(0);
  });
});

// ─── enforcePopulationBoundsSystem ───────────────────────────────────────────

describe('enforcePopulationBoundsSystem', () => {
  const baseConfig = {
    width: 240,
    height: 240,
    herbivoreSight: 5,
    carnivoreSpeed: 12,
  };

  it('REQ-SUST-001: 草食が HERBIVORE_MAX_POPULATION を N+1 件超えた場合に上限まで削除する', () => {
    // Arrange
    const world = new World();
    const excess = HERBIVORE_MAX_POPULATION + 1;
    for (let i = 0; i < excess; i++) {
      world.queueSpawn(Species.Herbivore, i % 240, (i * 3) % 240, 100, 22, 5);
    }
    world.commitCommands();

    // Act
    enforcePopulationBoundsSystem(world, baseConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Herbivore)).toBe(HERBIVORE_MAX_POPULATION);
  });

  it('REQ-SUST-001: 肉食が CARNIVORE_MAX_POPULATION + 1 のとき上限まで削除される（境界値 N+1）', () => {
    // Arrange
    const world = new World();
    const excess = CARNIVORE_MAX_POPULATION + 1;
    for (let i = 0; i < excess; i++) {
      world.queueSpawn(Species.Carnivore, i % 240, (i * 2) % 240, 100, 12, 10);
    }
    world.commitCommands();

    // Act
    enforcePopulationBoundsSystem(world, baseConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Carnivore)).toBe(CARNIVORE_MAX_POPULATION);
  });

  it('REQ-SUST-001: 草食が HERBIVORE_MIN_POPULATION を下回ると補充される（境界値 N-1）', () => {
    // Arrange
    const world = new World();
    const underMin = HERBIVORE_MIN_POPULATION - 1;
    for (let i = 0; i < underMin; i++) {
      world.queueSpawn(Species.Herbivore, i * 10, i * 10, 100, 22, 5);
    }
    world.commitCommands();

    // Act
    enforcePopulationBoundsSystem(world, baseConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Herbivore)).toBeGreaterThanOrEqual(HERBIVORE_MIN_POPULATION);
  });

  it('REQ-SUST-001: 肉食が CARNIVORE_MIN_POPULATION を下回ると補充される（境界値 N-1）', () => {
    // Arrange
    const world = new World();
    const underMin = CARNIVORE_MIN_POPULATION - 1;
    for (let i = 0; i < underMin; i++) {
      world.queueSpawn(Species.Carnivore, i * 10, i * 10, 100, 12, 10);
    }
    world.commitCommands();

    // Act
    enforcePopulationBoundsSystem(world, baseConfig);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Carnivore)).toBeGreaterThanOrEqual(CARNIVORE_MIN_POPULATION);
  });
});

// ─── ensureRefugiumGrowthSystem ───────────────────────────────────────────────

describe('ensureRefugiumGrowthSystem', () => {
  it('REQ-SUST-001: 草が REFUGIUM_MINIMUM_GRASS 未満の場合にスポーンが補充される', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    const refugium = {
      protectedSizeLimit: 1,
      grassSpawnFloor: REFUGIUM_MINIMUM_GRASS,
      refugeActive: true,
      biomassBuffer: 0,
    };

    // Act
    ensureRefugiumGrowthSystem(world, terrain, refugium, 240, 240, 0);
    world.commitCommands();

    // Assert
    expect(world.count(Species.Grass)).toBeGreaterThanOrEqual(REFUGIUM_MINIMUM_GRASS);
  });

  it('REQ-SUST-001: 草が十分にある場合は追加スポーンが発生しない', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    const abundantGrass = REFUGIUM_MINIMUM_GRASS + 10;
    for (let i = 0; i < abundantGrass; i++) {
      world.queueSpawn(Species.Grass, i * 2, i * 2, 0, 0, 0);
    }
    world.commitCommands();

    const refugium = {
      protectedSizeLimit: 1,
      grassSpawnFloor: REFUGIUM_MINIMUM_GRASS,
      refugeActive: true,
      biomassBuffer: 0,
    };
    const countBefore = world.count(Species.Grass);

    // Act
    ensureRefugiumGrowthSystem(world, terrain, refugium, 240, 240, 0);
    world.commitCommands();

    // Assert: 既に足りているので増えない
    expect(world.count(Species.Grass)).toBe(countBefore);
  });

  it('REQ-SUST-001: イベントコールバックに grass-spawn イベントが渡される', () => {
    // Arrange
    const world = new World();
    const terrain = new TerrainGrid(240, 240);
    const events: string[] = [];
    const refugium = {
      protectedSizeLimit: 1,
      grassSpawnFloor: 5,
      refugeActive: true,
      biomassBuffer: 0,
    };

    // Act
    ensureRefugiumGrowthSystem(
      world,
      terrain,
      refugium,
      240,
      240,
      0,
      (event) => events.push(event.type),
    );

    // Assert
    expect(events.every((type) => type === 'grass-spawn')).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });
});

