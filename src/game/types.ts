export type PuzzleId = 'colors' | 'shapes' | 'count' | 'memory' | 'rhythm' | 'switches';

export type StageId = 1 | 2 | 3 | 4;

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
  stage: StageId;
  stage1: ProgressState;
  stage2: ProgressState;
  stage3: ProgressState;
  stage4: ProgressState;
}
