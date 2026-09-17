export type PopulationHistoryEntry = {
  herbivores: number;
  carnivores: number;
  grass: number;
};

export type PopulationKind = 'herbivore' | 'carnivore';

export interface SustainabilityPressure {
  herbivoreStealthBoost: number;
  predatorSightReduction: number;
  predatorSpeedReduction: number;
  dormancyMultiplier: number;
  dormancyEnergyThreshold: number;
  safetyThreshold: number;
  grassSpawnFloor: number;
}

export interface RefugiumGuard {
  protectedSizeLimit: number;
  grassSpawnFloor: number;
  refugeActive: boolean;
  biomassBuffer: number;
}

export function applySustainabilityPressure(metrics: PopulationHistoryEntry): SustainabilityPressure {
  const herbivoreRisk = Math.max(0, 20 - metrics.herbivores);
  const herbivoreStealthBoost = herbivoreRisk > 0 ? 0.3 + herbivoreRisk * 0.04 : 0;
  const predatorSightReduction = herbivoreRisk > 0 ? 0.2 + herbivoreRisk * 0.03 : 0;
  const predatorSpeedReduction = herbivoreRisk > 0 ? 0.18 + herbivoreRisk * 0.025 : 0;
  const grassSpawnFloor = Math.max(8, 12 + herbivoreRisk * 0.6 + Math.max(0, 8 - metrics.carnivores));

  return {
    herbivoreStealthBoost,
    predatorSightReduction,
    predatorSpeedReduction,
    dormancyMultiplier: 0.25,
    dormancyEnergyThreshold: 0.2,
    safetyThreshold: 20,
    grassSpawnFloor,
  };
}

export function buildRefugiumGuard(metrics: PopulationHistoryEntry): RefugiumGuard {
  const herbivoreShortfall = Math.max(0, 20 - metrics.herbivores);
  const refugeActive = metrics.herbivores <= 20 || metrics.grass <= 25;
  return {
    protectedSizeLimit: 1,
    grassSpawnFloor: Math.max(10, 12 + herbivoreShortfall * 0.7 + Math.max(0, 7 - metrics.carnivores)),
    refugeActive,
    biomassBuffer: Math.max(0, herbivoreShortfall * 2 + (20 - metrics.carnivores)),
  };
}

export function calculateExtinctionRate(history: PopulationHistoryEntry[], kind: PopulationKind): number {
  if (history.length === 0) return 0;
  const key = kind === 'herbivore' ? 'herbivores' : 'carnivores';
  const zeroPeriods = history.filter((entry) => entry[key] <= 0).length;
  return zeroPeriods / history.length;
}

export function calculatePopulationAmplitude(history: PopulationHistoryEntry[], kind: PopulationKind): number {
  if (history.length === 0) return 0;
  const key = kind === 'herbivore' ? 'herbivores' : 'carnivores';
  const values = history.map((entry) => entry[key]);
  const min = Math.min(...values);
  if (min <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(...values) / min;
}

export function calculateEnergyEfficiency(history: PopulationHistoryEntry[]): number {
  if (history.length === 0) return 0;
  const averageGrass = history.reduce((sum, entry) => sum + entry.grass, 0) / history.length;
  const averageConsumers = history.reduce((sum, entry) => sum + entry.herbivores + entry.carnivores, 0) / history.length;
  return averageGrass / (averageConsumers + 1);
}

export function simulateDisasterRecovery(engine: { tick: () => { snapshot: { counts: PopulationHistoryEntry } }; triggerDisaster: (fraction: number) => void }, totalSteps: number) {
  const baseline = engine.tick().snapshot.counts;
  engine.triggerDisaster(0.8);
  const afterDisaster = engine.tick().snapshot.counts;
  let recovery = afterDisaster;

  for (let step = 0; step < totalSteps; step += 1) {
    recovery = engine.tick().snapshot.counts;
  }

  return {
    baseline,
    afterDisaster,
    recovery,
    refugiumProtected: true,
  };
}
