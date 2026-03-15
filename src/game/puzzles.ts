import type { PuzzleId } from './types';

export const STAGE_TITLE = '무지개 교실';
export const STAGE_SUBTITLE = '별 조각 4개를 모아 무지개 문을 열자.';

export const PUZZLE_IDS: PuzzleId[] = ['colors', 'shapes', 'count', 'memory'];

export const COLOR_SEQUENCE = ['red', 'blue', 'yellow'] as const;
export const SHAPE_ORDER = ['circle', 'triangle', 'square'] as const;
export const COUNTING_OPTIONS = [5, 6, 7] as const;
export const COUNTING_ANSWER = 6;
export const MEMORY_SEQUENCE = ['pink', 'sky', 'sun'] as const;

export type ColorButton = (typeof COLOR_SEQUENCE)[number];
export type ShapeButton = (typeof SHAPE_ORDER)[number];
export type MemoryButton = (typeof MEMORY_SEQUENCE)[number];

export interface PuzzleDefinition {
  title: string;
  subtitle: string;
  prompt: string;
  hint: string;
  success: string;
  pedestalColor: [number, number, number];
}

export const PUZZLE_DEFINITIONS: Record<PuzzleId, PuzzleDefinition> = {
  colors: {
    title: '무지개 버튼',
    subtitle: '포스터의 색 순서를 기억해서 버튼을 누르자.',
    prompt: '빨강, 파랑, 노랑 순서를 찾아 보자.',
    hint: '벽 포스터가 빨강, 파랑, 노랑 순서를 알려준다.',
    success: '색 포털이 반짝이며 첫 번째 별 조각이 나왔다.',
    pedestalColor: [1, 0.48, 0.44],
  },
  shapes: {
    title: '도형 자물쇠',
    subtitle: '각 칸을 눌러서 원, 세모, 네모로 맞춰 보자.',
    prompt: '도형을 차례대로 바꿔서 문양을 완성하자.',
    hint: '왼쪽부터 원, 세모, 네모가 정답이다.',
    success: '도형 램프가 켜지며 두 번째 별 조각을 얻었다.',
    pedestalColor: [0.43, 0.78, 1],
  },
  count: {
    title: '연필 세기',
    subtitle: '교실 한쪽의 연필이 몇 개인지 세어 보자.',
    prompt: '노란 연필을 세고 숫자를 고르자.',
    hint: '책상 위 노란 연필 꾸러미를 하나씩 세면 된다.',
    success: '숫자 패널이 열리며 세 번째 별 조각이 떨어졌다.',
    pedestalColor: [1, 0.82, 0.3],
  },
  memory: {
    title: '반짝반짝 기억판',
    subtitle: '빛나는 순서를 보고 그대로 다시 눌러 보자.',
    prompt: '핑크, 하늘, 노랑 빛의 순서를 기억하자.',
    hint: '반짝임은 세 번 나타난다. 차분히 보고 같은 순서를 누르면 된다.',
    success: '기억판이 열리며 마지막 별 조각이 완성됐다.',
    pedestalColor: [0.56, 0.93, 0.82],
  },
};

export const COLOR_LABELS: Record<ColorButton, string> = {
  red: '빨강',
  blue: '파랑',
  yellow: '노랑',
};

export const COLOR_HEX: Record<ColorButton, string> = {
  red: '#f45e58',
  blue: '#4794ff',
  yellow: '#ffbe37',
};

export const SHAPE_LABELS: Record<ShapeButton, string> = {
  circle: '원',
  triangle: '세모',
  square: '네모',
};

export const SHAPE_SYMBOLS: Record<ShapeButton, string> = {
  circle: '●',
  triangle: '▲',
  square: '■',
};

export const MEMORY_LABELS: Record<MemoryButton, string> = {
  pink: '핑크',
  sky: '하늘',
  sun: '노랑',
};
