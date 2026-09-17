import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../apps/worker/src/engine/simulation-engine';
import { calculateEnergyEfficiency, calculateExtinctionRate, calculatePopulationAmplitude, applySustainabilityPressure, buildRefugiumGuard, simulateDisasterRecovery } from '../systems/sustainabilitySystem';

describe('REQ-SUST-001: シンセティックトランザクションによる長期生態系監視', () => {
  it('長期持続性チェック: 草食と肉食の絶滅ゼロと変動幅が安全範囲内である', () => {
    // Arrange
    const engine = new SimulationEngine('synthetic-long-term', 960, 540);
    const history: Array<{ herbivores: number; carnivores: number; grass: number }> = [];

    // Act
    for (let step = 0; step < 10000; step += 1) {
      const result = engine.tick();
      history.push({
        herbivores: result.snapshot.counts.herbivores,
        carnivores: result.snapshot.counts.carnivores,
        grass: result.snapshot.counts.grass,
      });
    }

    // Assert
    const extinctionRate = calculateExtinctionRate(history, 'herbivore');
    const carnivoreExtinction = calculateExtinctionRate(history, 'carnivore');
    const herbivoreAmplitude = calculatePopulationAmplitude(history, 'herbivore');
    const carnivoreAmplitude = calculatePopulationAmplitude(history, 'carnivore');
    const energyEfficiency = calculateEnergyEfficiency(history);

    expect(extinctionRate).toBe(0);
    expect(carnivoreExtinction).toBe(0);
    expect(herbivoreAmplitude).toBeLessThanOrEqual(8.5);
    expect(carnivoreAmplitude).toBeLessThanOrEqual(8.5);
    expect(energyEfficiency).toBeGreaterThan(0.15);
  });

  it('災害回復チェック: 80% の個体が喪失しても生態系が回復する', () => {
    // Arrange
    const engine = new SimulationEngine('synthetic-disaster', 960, 540);

    // Act
    const result = simulateDisasterRecovery(engine, 3000);

    // Assert
    expect(result.baseline.herbivores).toBeGreaterThan(0);
    expect(result.recovery.herbivores).toBeGreaterThan(result.afterDisaster.herbivores * 0.6);
    expect(result.recovery.carnivores).toBeGreaterThan(0);
    expect(result.recovery.grass).toBeGreaterThan(0);
    expect(result.refugiumProtected).toBe(true);
  });

  it('REQ-SUST-002: 低個体数時の負のフィードバックと避難所が有効になる', () => {
    // Arrange
    const metrics = { herbivores: 12, carnivores: 3, grass: 10 };

    // Act
    const pressure = applySustainabilityPressure(metrics);
    const refugium = buildRefugiumGuard(metrics);

    // Assert
    expect(pressure.predatorSightReduction).toBeGreaterThan(0);
    expect(pressure.herbivoreStealthBoost).toBeGreaterThan(0);
    expect(refugium.protectedSizeLimit).toBeLessThanOrEqual(1);
    expect(refugium.grassSpawnFloor).toBeGreaterThan(0);
  });
});
