import type { PuzzleId } from './types';

export const STAGE_TITLE = '무지개 탐험 교실';
export const STAGE_SUBTITLE = '앞쪽 교실 3개, 뒤쪽 연구 구역 3개 퍼즐을 풀고 별 조각 6개를 모아 탈출하자.';

export const STAGE_2_TITLE = '별빛 정원';
export const STAGE_2_SUBTITLE = '정원 곳곳에 숨겨진 6개의 별빛 퍼즐을 풀고 마법의 문을 열자.';

export const PUZZLE_IDS: PuzzleId[] = ['colors', 'shapes', 'count', 'memory', 'rhythm', 'switches'];

export const COLOR_SEQUENCE = ['red', 'blue', 'yellow', 'green', 'pink'] as const;
export const SHAPE_ORDER = ['circle', 'triangle', 'square', 'diamond'] as const;
export const COUNTING_OPTIONS = [6, 7, 8, 9, 10, 11] as const;
export const COUNTING_ANSWER = 8;
export const MEMORY_SEQUENCE = ['pink', 'sky', 'sun', 'mint', 'sky', 'pink', 'sun'] as const;
export const RHYTHM_SEQUENCE = ['do', 'mi', 'sol', 'la', 'sol', 'mi'] as const;
export const SWITCH_TARGET = [true, false, true, true, false] as const;
export const SWITCH_LINKED = false;
export const FINAL_DOOR_COLOR_CHOICES = ['yellow', 'green', 'pink'] as const;
export const FINAL_DOOR_SHAPE_CHOICES = ['triangle', 'diamond', 'square'] as const;
export const FINAL_DOOR_NOTE_CHOICES = ['do', 'sol', 'la'] as const;
export const FINAL_DOOR_ANSWER = {
  color: 'green',
  shape: 'diamond',
  note: 'sol',
} as const;

export type ColorButton = (typeof COLOR_SEQUENCE)[number];
export type ShapeButton = (typeof SHAPE_ORDER)[number] | 'star';
export type MemoryButton = (typeof MEMORY_SEQUENCE)[number];
export type RhythmButton = (typeof RHYTHM_SEQUENCE)[number] | 'ti';

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
    subtitle: '교실 어딘가에 숨겨진 색 단서를 찾아 다섯 버튼을 순서대로 누르자.',
    prompt: '교실을 둘러보고 색 순서 단서를 찾아보자.',
    hint: '교실 바닥이나 가구 근처를 잘 살펴보면 색 힌트가 보일 거야.',
    success: '색 포털이 길게 반짝이며 첫 번째 별 조각이 나왔다.',
    pedestalColor: [1, 0.48, 0.44],
  },
  shapes: {
    title: '도형 자물쇠',
    subtitle: '다섯 가지 도형 중 네 개를 올바른 순서로 맞추자.',
    prompt: '교실 안 숨겨진 도형 단서를 찾아 배열을 완성하자.',
    hint: '꼭짓점이 없는 것부터 많은 순서로 생각해 보자.',
    success: '도형 자물쇠가 풀리며 두 번째 별 조각을 얻었다.',
    pedestalColor: [0.43, 0.78, 1],
  },
  count: {
    title: '연필 꾸러미',
    subtitle: '교실 여기저기 섞여 있는 소품 중 줄무늬 연필만 세어 보자.',
    prompt: '줄무늬 연필의 개수를 맞히자. 비슷한 물건에 속지 마!',
    hint: '크레파스와 짧은 막대는 연필이 아니야. 노란 긴 것만 세자.',
    success: '숫자 패널이 열리며 세 번째 별 조각이 떨어졌다.',
    pedestalColor: [1, 0.82, 0.3],
  },
  memory: {
    title: '기억 실험판',
    subtitle: '일곱 번 깜빡이는 빛 순서를 정확히 따라 누르자.',
    prompt: '반짝임을 끝까지 본 뒤 같은 순서를 재현하자.',
    hint: '처음과 끝을 먼저 기억하면 중간도 떠오를 거야.',
    success: '기억판이 열리며 네 번째 별 조각이 완성됐다.',
    pedestalColor: [0.56, 0.93, 0.82],
  },
  rhythm: {
    title: '멜로디 패널',
    subtitle: '다섯 개의 음 패드를 순서대로 눌러 여섯 음 멜로디를 완성하자.',
    prompt: '숨겨진 악보 단서를 찾아 멜로디 순서를 알아내자.',
    hint: '높은 음으로 올라갔다가 다시 내려오는 흐름이야.',
    success: '음계 패널이 울리며 다섯 번째 별 조각이 나타났다.',
    pedestalColor: [0.73, 0.62, 1],
  },
  switches: {
    title: '전원 스위치',
    subtitle: '다섯 토글의 불빛 상태를 목표 패턴과 똑같이 맞추자.',
    prompt: '숨겨진 전등 패턴 단서를 찾아 스위치를 조합하자.',
    hint: '스위치를 누르면 양옆 스위치도 같이 바뀌니 순서를 잘 생각하자.',
    success: '전원 회로가 맞아떨어지며 마지막 별 조각이 충전됐다.',
    pedestalColor: [0.99, 0.68, 0.86],
  },
};

export const STAGE_2_DEFINITIONS: Record<PuzzleId, PuzzleDefinition> = {
  colors: {
    title: '별빛 물감',
    subtitle: '정원 어딘가에 숨겨진 색 단서를 찾아 일곱 버튼을 순서대로 누르자.',
    prompt: '정원을 둘러보고 색 순서 단서를 찾아보자.',
    hint: '나무 뒤쪽이나 꽃밭 근처를 잘 살펴보자.',
    success: '별빛 물감이 반짝이며 첫 번째 별빛 조각이 나왔다.',
    pedestalColor: [0.9, 0.4, 0.6],
  },
  shapes: {
    title: '별자리 자물쇠',
    subtitle: '다섯 가지 도형 중 다섯 개를 올바른 순서로 맞추자.',
    prompt: '정원 안 숨겨진 별자리 단서를 찾아 배열을 완성하자.',
    hint: '밤하늘의 별 모양을 잘 살펴보자.',
    success: '별자리 자물쇠가 풀리며 두 번째 별빛 조각을 얻었다.',
    pedestalColor: [0.3, 0.5, 0.9],
  },
  count: {
    title: '반딧불 세기',
    subtitle: '정원에 떠다니는 반딧불 중 초록빛만 세어 보자.',
    prompt: '초록 반딧불의 개수를 맞히자.',
    hint: '노란 반딧불과 구분해서 세자.',
    success: '반딧불이 모여 세 번째 별빛 조각이 됐다.',
    pedestalColor: [0.4, 0.9, 0.5],
  },
  memory: {
    title: '별빛 기억판',
    subtitle: '일곱 번 깜빡이는 빛 순서를 정확히 따라 누르자.',
    prompt: '별빛의 순서를 기억해서 재현하자.',
    hint: '패턴 속에 반복되는 색이 있어.',
    success: '별빛 기억판이 열리며 네 번째 별빛 조각이 나왔다.',
    pedestalColor: [0.7, 0.85, 0.95],
  },
  rhythm: {
    title: '풀벌레 합창',
    subtitle: '일곱 음으로 이루어진 풀벌레 멜로디를 완성하자.',
    prompt: '숨겨진 악보를 찾아 멜로디를 알아내자.',
    hint: '같은 음이 두 번 연속 나오는 곳이 있어.',
    success: '풀벌레 합창이 울리며 다섯 번째 별빛 조각이 나왔다.',
    pedestalColor: [0.5, 0.4, 0.8],
  },
  switches: {
    title: '정원 등불',
    subtitle: '일곱 등불의 상태를 목표 패턴에 맞추자. 연결된 등불도 같이 바뀐다!',
    prompt: '숨겨진 등불 패턴을 찾아 스위치를 조합하자.',
    hint: '등불을 켜면 옆 등불도 바뀌니 순서가 중요해.',
    success: '정원 등불이 밝혀지며 마지막 별빛 조각이 나왔다.',
    pedestalColor: [0.9, 0.75, 0.4],
  },
};

// Stage 2 puzzle data (harder)
export const STAGE_2_COLOR_SEQUENCE = ['green', 'pink', 'blue', 'red', 'yellow', 'pink', 'green'] as const;
export const STAGE_2_SHAPE_ORDER = ['star', 'circle', 'diamond', 'triangle', 'square'] as const;
export const STAGE_2_COUNTING_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12] as const;
export const STAGE_2_COUNTING_ANSWER = 9;
export const STAGE_2_MEMORY_SEQUENCE = ['mint', 'sun', 'pink', 'sky', 'sun', 'mint', 'sky'] as const;
export const STAGE_2_RHYTHM_SEQUENCE = ['sol', 'mi', 'do', 'la', 'sol', 'mi', 'do'] as const;
export const STAGE_2_SWITCH_TARGET = [true, true, false, true, false, true, true] as const;
export const STAGE_2_SWITCH_LINKED = true;
export const STAGE_2_FINAL_DOOR_ANSWER = {
  color: 'pink',
  shape: 'star',
  note: 'mi',
} as const;

export const COLOR_LABELS: Record<ColorButton, string> = {
  red: '빨강',
  blue: '파랑',
  yellow: '노랑',
  green: '초록',
  pink: '핑크',
};

export const COLOR_HEX: Record<ColorButton, string> = {
  red: '#f45e58',
  blue: '#4794ff',
  yellow: '#ffbe37',
  green: '#59d98d',
  pink: '#ff82c3',
};

export const SHAPE_LABELS: Record<ShapeButton, string> = {
  circle: '원',
  triangle: '세모',
  square: '네모',
  diamond: '마름모',
  star: '별',
};

export const SHAPE_SYMBOLS: Record<ShapeButton, string> = {
  circle: '●',
  triangle: '▲',
  square: '■',
  diamond: '◆',
  star: '★',
};

export const MEMORY_LABELS: Record<MemoryButton, string> = {
  pink: '핑크',
  sky: '하늘',
  sun: '노랑',
  mint: '민트',
};

export const MEMORY_HEX: Record<MemoryButton, string> = {
  pink: '#ff82c3',
  sky: '#67b6ff',
  sun: '#ffd149',
  mint: '#5ce0c8',
};

export const RHYTHM_LABELS: Record<RhythmButton, string> = {
  do: '도',
  mi: '미',
  sol: '솔',
  la: '라',
  ti: '시',
};
