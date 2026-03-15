import type { ProgressState, PuzzleId } from './types';

const STORAGE_KEY = 'jennyworld-stage-1-progress';

export const createInitialProgress = (): ProgressState => ({
  colors: false,
  shapes: false,
  count: false,
  memory: false,
  cleared: false,
});

export const countSolvedPuzzles = (progress: ProgressState): number => {
  const puzzleKeys: PuzzleId[] = ['colors', 'shapes', 'count', 'memory'];
  return puzzleKeys.reduce((total, puzzleId) => total + Number(progress[puzzleId]), 0);
};

export class ProgressStore {
  load(): ProgressState {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return createInitialProgress();
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ProgressState>;
      return {
        ...createInitialProgress(),
        ...parsed,
      };
    } catch {
      return createInitialProgress();
    }
  }

  save(progress: ProgressState): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  reset(): ProgressState {
    const fresh = createInitialProgress();
    this.save(fresh);
    return fresh;
  }
}
