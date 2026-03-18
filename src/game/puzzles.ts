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
    hint: '별에서 시작해 꼭짓점이 줄어드는 순서를 생각해 보자.',
    success: '별자리 자물쇠가 풀리며 두 번째 별빛 조각을 얻었다.',
    pedestalColor: [0.3, 0.5, 0.9],
  },
  count: {
    title: '반딧불 세기',
    subtitle: '정원에 떠다니는 반딧불 중 초록빛만 세어 보자.',
    prompt: '초록 반딧불의 개수를 맞히자.',
    hint: '노란 반딧불 5마리에 속지 말고, 초록빛만 정원 전체에서 세자.',
    success: '반딧불이 모여 세 번째 별빛 조각이 됐다.',
    pedestalColor: [0.4, 0.9, 0.5],
  },
  memory: {
    title: '별빛 기억판',
    subtitle: '일곱 번 깜빡이는 빛 순서를 정확히 따라 누르자.',
    prompt: '별빛의 순서를 기억해서 재현하자.',
    hint: '처음 세 색과 마지막 세 색이 대칭에 가까워. 가운데를 기준으로 외워 보자.',
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
export const STAGE_2_FINAL_DOOR_COLOR_CHOICES = ['pink', 'green', 'blue'] as const;
export const STAGE_2_FINAL_DOOR_SHAPE_CHOICES = ['star', 'diamond', 'circle'] as const;
export const STAGE_2_FINAL_DOOR_NOTE_CHOICES = ['mi', 'sol', 'do'] as const;
export const STAGE_2_FINAL_DOOR_ANSWER = {
  color: 'pink',
  shape: 'star',
  note: 'mi',
} as const;

// === Stage 3: 얼음 동굴 (Ice Cave) ===
export const STAGE_3_TITLE = '얼음 동굴';
export const STAGE_3_SUBTITLE = '얼어붙은 동굴 깊은 곳에 숨겨진 6개의 빙결 퍼즐을 풀고 탈출하자.';

export const STAGE_3_DEFINITIONS: Record<PuzzleId, PuzzleDefinition> = {
  colors: {
    title: '얼음 프리즘',
    subtitle: '프리즘에 비친 일곱 가지 빛을 순서대로 맞추자.',
    prompt: '동굴 벽에 새겨진 빛의 순서를 찾아보자.',
    hint: '따뜻한 색에서 차가운 색으로, 다시 따뜻한 색으로.',
    success: '프리즘이 빛나며 첫 번째 빙결 조각이 나왔다.',
    pedestalColor: [0.6, 0.85, 1],
  },
  shapes: {
    title: '결정 자물쇠',
    subtitle: '얼음 결정 다섯 개를 올바른 배열로 맞추자.',
    prompt: '동굴 천장의 결정 패턴을 관찰하자.',
    hint: '대칭 구조야. 가운데를 기준으로 양쪽이 같아.',
    success: '결정 자물쇠가 풀리며 두 번째 빙결 조각을 얻었다.',
    pedestalColor: [0.4, 0.65, 0.95],
  },
  count: {
    title: '고드름 세기',
    subtitle: '동굴 천장에 매달린 파란 고드름만 세어 보자.',
    prompt: '투명한 고드름은 빼고, 파란 고드름만 세자.',
    hint: '투명 고드름 4개에 속지 말고, 파란빛만 정확히 세자.',
    success: '고드름이 반짝이며 세 번째 빙결 조각이 떨어졌다.',
    pedestalColor: [0.5, 0.8, 1],
  },
  memory: {
    title: '빙결 기억판',
    subtitle: '일곱 번 깜빡이는 빙결 순서를 따라 누르자.',
    prompt: '빙결 빛의 순서를 기억해서 재현하자.',
    hint: '첫 네 개와 마지막 세 개가 반대 순서야.',
    success: '빙결 기억판이 열리며 네 번째 빙결 조각이 나왔다.',
    pedestalColor: [0.7, 0.9, 1],
  },
  rhythm: {
    title: '얼음 종소리',
    subtitle: '일곱 개의 얼음 종을 올바른 순서로 울리자.',
    prompt: '동굴에 울리는 메아리를 기억하자.',
    hint: '낮은 음에서 시작해 높이 올라갔다가 급히 내려와.',
    success: '종소리가 울리며 다섯 번째 빙결 조각이 나타났다.',
    pedestalColor: [0.55, 0.7, 0.95],
  },
  switches: {
    title: '얼음 레버',
    subtitle: '일곱 레버를 목표 패턴에 맞추자. 연결된 레버도 같이 움직인다!',
    prompt: '동굴 벽의 얼음 패턴을 찾아 레버를 조합하자.',
    hint: '가운데 레버를 먼저 맞추고 양쪽으로 퍼져 나가자.',
    success: '얼음 회로가 연결되며 마지막 빙결 조각이 나왔다.',
    pedestalColor: [0.45, 0.75, 0.98],
  },
};

export const STAGE_3_COLOR_SEQUENCE = ['red', 'yellow', 'green', 'blue', 'pink', 'blue', 'red'] as const;
export const STAGE_3_SHAPE_ORDER = ['diamond', 'triangle', 'star', 'triangle', 'diamond'] as const;
export const STAGE_3_COUNTING_OPTIONS = [6, 7, 8, 9, 10, 11] as const;
export const STAGE_3_COUNTING_ANSWER = 7;
export const STAGE_3_MEMORY_SEQUENCE = ['sky', 'mint', 'sun', 'pink', 'sun', 'mint', 'sky'] as const;
export const STAGE_3_RHYTHM_SEQUENCE = ['do', 'mi', 'sol', 'la', 'ti', 'sol', 'do'] as const;
export const STAGE_3_SWITCH_TARGET = [false, true, true, false, true, true, false] as const;
export const STAGE_3_SWITCH_LINKED = true;
export const STAGE_3_FINAL_DOOR_COLOR_CHOICES = ['red', 'blue', 'green'] as const;
export const STAGE_3_FINAL_DOOR_SHAPE_CHOICES = ['star', 'triangle', 'diamond'] as const;
export const STAGE_3_FINAL_DOOR_NOTE_CHOICES = ['do', 'ti', 'sol'] as const;
export const STAGE_3_FINAL_DOOR_ANSWER = { color: 'blue', shape: 'star', note: 'do' } as const;

// === Stage 4: 하늘 성 (Sky Castle) ===
export const STAGE_4_TITLE = '하늘 성';
export const STAGE_4_SUBTITLE = '구름 위의 성에 숨겨진 6개의 천공 퍼즐을 풀고 마지막 문을 열자.';

export const STAGE_4_DEFINITIONS: Record<PuzzleId, PuzzleDefinition> = {
  colors: {
    title: '무지개 아치',
    subtitle: '하늘에 걸린 무지개의 일곱 색을 순서대로 맞추자.',
    prompt: '성벽의 스테인드글라스에서 단서를 찾아보자.',
    hint: '무지개는 빨주노초파남보, 하지만 여기서는 다른 순서야.',
    success: '무지개 아치가 빛나며 첫 번째 천공 조각이 나왔다.',
    pedestalColor: [1, 0.8, 0.5],
  },
  shapes: {
    title: '별자리 배열',
    subtitle: '다섯 별자리를 하늘의 배열대로 놓자.',
    prompt: '성 꼭대기에서 밤하늘을 올려다보자.',
    hint: '각 꼭짓점 수가 줄었다 늘었다를 반복해.',
    success: '별자리가 맞춰지며 두 번째 천공 조각을 얻었다.',
    pedestalColor: [0.9, 0.7, 0.3],
  },
  count: {
    title: '깃발 세기',
    subtitle: '성벽에 걸린 금색 깃발만 세어 보자.',
    prompt: '은색 깃발과 구분해서 금색만 세자.',
    hint: '은색 깃발 6개에 속지 말고, 금색만 세자.',
    success: '깃발이 펄럭이며 세 번째 천공 조각이 떨어졌다.',
    pedestalColor: [1, 0.85, 0.4],
  },
  memory: {
    title: '구름 기억판',
    subtitle: '일곱 번 깜빡이는 구름 순서를 따라 누르자.',
    prompt: '구름의 색 순서를 기억해서 재현하자.',
    hint: '같은 색이 세 번 나와. 그 위치를 먼저 기억하자.',
    success: '구름 기억판이 열리며 네 번째 천공 조각이 나왔다.',
    pedestalColor: [1, 0.95, 0.8],
  },
  rhythm: {
    title: '바람의 노래',
    subtitle: '일곱 개의 바람 소리를 올바른 순서로 연주하자.',
    prompt: '성 탑에서 들리는 바람의 멜로디를 기억하자.',
    hint: '같은 음이 세 번 연속으로 나온 뒤 급변해.',
    success: '바람의 노래가 울리며 다섯 번째 천공 조각이 나타났다.',
    pedestalColor: [0.85, 0.75, 0.95],
  },
  switches: {
    title: '성문 장치',
    subtitle: '일곱 장치를 목표 패턴에 맞추자. 연결된 장치도 같이 움직인다!',
    prompt: '성벽 문양에서 장치 패턴을 찾아보자.',
    hint: '양쪽 끝부터 안쪽으로 맞춰 나가자.',
    success: '성문 장치가 맞아떨어지며 마지막 천공 조각이 나왔다.',
    pedestalColor: [0.95, 0.85, 0.65],
  },
};

export const STAGE_4_COLOR_SEQUENCE = ['blue', 'green', 'yellow', 'red', 'pink', 'red', 'blue'] as const;
export const STAGE_4_SHAPE_ORDER = ['triangle', 'star', 'circle', 'star', 'triangle'] as const;
export const STAGE_4_COUNTING_OPTIONS = [7, 8, 9, 10, 11, 12] as const;
export const STAGE_4_COUNTING_ANSWER = 10;
export const STAGE_4_MEMORY_SEQUENCE = ['pink', 'pink', 'sky', 'mint', 'sun', 'pink', 'mint'] as const;
export const STAGE_4_RHYTHM_SEQUENCE = ['la', 'la', 'la', 'do', 'ti', 'sol', 'mi'] as const;
export const STAGE_4_SWITCH_TARGET = [true, false, true, false, true, false, true] as const;
export const STAGE_4_SWITCH_LINKED = true;
export const STAGE_4_FINAL_DOOR_COLOR_CHOICES = ['blue', 'red', 'pink'] as const;
export const STAGE_4_FINAL_DOOR_SHAPE_CHOICES = ['circle', 'star', 'triangle'] as const;
export const STAGE_4_FINAL_DOOR_NOTE_CHOICES = ['la', 'mi', 'do'] as const;
export const STAGE_4_FINAL_DOOR_ANSWER = { color: 'red', shape: 'circle', note: 'la' } as const;

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
