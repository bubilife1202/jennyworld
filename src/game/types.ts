export type PuzzleId = 'colors' | 'shapes' | 'count' | 'memory';

export interface ProgressState {
  colors: boolean;
  shapes: boolean;
  count: boolean;
  memory: boolean;
  cleared: boolean;
}

export interface PromptState {
  title: string;
  detail: string;
  actionLabel: string;
}
