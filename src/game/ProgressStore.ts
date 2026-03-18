import { PUZZLE_IDS } from './puzzles';
import type { GameProgress, ProgressState, StageId } from './types';

const STORAGE_KEY = 'jennyworld-progress-v2';
const LEGACY_KEY = 'jennyworld-stage-1-progress';

const toBoolean = (value: unknown): boolean => value === true;

export const createInitialProgress = (): ProgressState => ({
  colors: false,
  shapes: false,
  count: false,
  memory: false,
  rhythm: false,
  switches: false,
  cleared: false,
});

export const createInitialGameProgress = (): GameProgress => ({
  stage: 1,
  stage1: createInitialProgress(),
  stage2: createInitialProgress(),
  stage3: createInitialProgress(),
  stage4: createInitialProgress(),
});

export const countSolvedPuzzles = (progress: ProgressState): number => {
  return PUZZLE_IDS.reduce((total, puzzleId) => total + Number(progress[puzzleId]), 0);
};

const parseProgressState = (parsed: Partial<ProgressState>): ProgressState => ({
  colors: toBoolean(parsed.colors),
  shapes: toBoolean(parsed.shapes),
  count: toBoolean(parsed.count),
  memory: toBoolean(parsed.memory),
  rhythm: toBoolean(parsed.rhythm),
  switches: toBoolean(parsed.switches),
  cleared: toBoolean(parsed.cleared),
});

const validStage = (value: unknown): StageId => {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  return 1;
};

export class ProgressStore {
  load(): GameProgress {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameProgress>;
        return {
          stage: validStage(parsed.stage),
          stage1: parseProgressState((parsed.stage1 ?? {}) as Partial<ProgressState>),
          stage2: parseProgressState((parsed.stage2 ?? {}) as Partial<ProgressState>),
          stage3: parseProgressState((parsed.stage3 ?? {}) as Partial<ProgressState>),
          stage4: parseProgressState((parsed.stage4 ?? {}) as Partial<ProgressState>),
        };
      }
    } catch {
      // Fall through
    }

    try {
      const raw = window.localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ProgressState>;
        const gameProgress = createInitialGameProgress();
        gameProgress.stage1 = parseProgressState(parsed);
        this.save(gameProgress);
        try { window.localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
        return gameProgress;
      }
    } catch {
      // Fall through
    }

    return createInitialGameProgress();
  }

  save(progress: GameProgress): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage quota/privacy failures
    }
  }

  reset(): GameProgress {
    const fresh = createInitialGameProgress();
    this.save(fresh);
    return fresh;
  }
}
