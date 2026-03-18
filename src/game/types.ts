export type PuzzleId = 'colors' | 'shapes' | 'count' | 'memory' | 'rhythm' | 'switches';

export interface ProgressState {
  colors: boolean;
  shapes: boolean;
  count: boolean;
  memory: boolean;
  rhythm: boolean;
  switches: boolean;
  cleared: boolean;
}

export interface PromptState {
  title: string;
  detail: string;
  actionLabel: string;
}

export interface GameProgress {
  stage: 1 | 2;
  stage1: ProgressState;
  stage2: ProgressState;
}
