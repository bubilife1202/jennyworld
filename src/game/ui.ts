import {
  COLOR_HEX,
  COLOR_LABELS,
  COLOR_SEQUENCE,
  COUNTING_ANSWER,
  COUNTING_OPTIONS,
  MEMORY_LABELS,
  MEMORY_SEQUENCE,
  PUZZLE_DEFINITIONS,
  SHAPE_LABELS,
  SHAPE_ORDER,
  SHAPE_SYMBOLS,
  STAGE_SUBTITLE,
  STAGE_TITLE,
  type MemoryButton,
  type ShapeButton,
} from './puzzles';
import type { ProgressState, PuzzleId } from './types';

interface OverlayHandlers {
  onReset?: () => void;
  onStart?: () => void;
  onOpenPuzzle?: (puzzleId: PuzzleId) => void;
  onOpenDoor?: () => void;
}

const PUZZLE_BUTTON_META: Record<PuzzleId, { label: string; emoji: string }> = {
  colors: { label: '색 버튼', emoji: '🌈' },
  shapes: { label: '도형 자물쇠', emoji: '🔺' },
  count: { label: '연필 세기', emoji: '✏️' },
  memory: { label: '기억 퍼즐', emoji: '✨' },
};

export class OverlayUI {
  readonly canvas: HTMLCanvasElement;

  private handlers: OverlayHandlers = {};
  private readonly stageNote: HTMLDivElement;
  private readonly stageDock: HTMLDivElement;
  private readonly objectiveTitle: HTMLParagraphElement;
  private readonly objectiveDetail: HTMLParagraphElement;
  private readonly starsCount: HTMLParagraphElement;
  private readonly starDots: HTMLSpanElement[];
  private readonly modalBackdrop: HTMLDivElement;
  private readonly modalTitle: HTMLHeadingElement;
  private readonly modalBody: HTMLDivElement;
  private readonly modalClose: HTMLButtonElement;
  private readonly toast: HTMLDivElement;
  private readonly introOverlay: HTMLDivElement;
  private readonly startButton: HTMLButtonElement;
  private readonly clearOverlay: HTMLDivElement;
  private readonly replayButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly puzzleButtons: Record<PuzzleId, HTMLButtonElement>;
  private readonly doorButton: HTMLButtonElement;
  private toastTimer: number | null = null;
  private activeTimers: number[] = [];

  constructor(mount: HTMLElement) {
    mount.innerHTML = `
      <div class="game-shell">
        <canvas class="game-canvas" aria-label="Jennyworld game scene"></canvas>
        <div class="hud-layer">
          <div class="topbar">
            <section class="hud-card brand-card">
              <p class="eyebrow">PlayCanvas Escape Room</p>
              <h1 class="brand-title">${STAGE_TITLE}</h1>
              <p class="brand-subtitle">${STAGE_SUBTITLE}</p>
            </section>
            <div class="progress-cluster">
              <section class="hud-card stars-card">
                <span class="stars-label">모은 별 조각</span>
                <p class="stars-count">0 / 4</p>
                <div class="stars-strip" aria-hidden="true">
                  <span class="star-dot"></span>
                  <span class="star-dot"></span>
                  <span class="star-dot"></span>
                  <span class="star-dot"></span>
                </div>
              </section>
              <button class="reset-button" type="button">다시 시작</button>
            </div>
          </div>

          <section class="hud-card stage-note">
            <p class="objective-title">퍼즐 버튼을 누르자</p>
            <p class="objective-detail">아래 큰 버튼 네 개로 퍼즐을 차례대로 열고, 별을 모두 모으면 무지개 문을 열 수 있다.</p>
          </section>

          <section class="hud-card stage-dock" aria-label="퍼즐 스테이션">
            <button class="station-button" data-puzzle="colors" type="button">
              <span class="station-emoji">🌈</span>
              <span class="station-text">
                <strong>색 버튼</strong>
                <small>빨강, 파랑, 노랑 순서</small>
              </span>
            </button>
            <button class="station-button" data-puzzle="shapes" type="button">
              <span class="station-emoji">🔺</span>
              <span class="station-text">
                <strong>도형 자물쇠</strong>
                <small>원, 세모, 네모 맞추기</small>
              </span>
            </button>
            <button class="station-button" data-puzzle="count" type="button">
              <span class="station-emoji">✏️</span>
              <span class="station-text">
                <strong>연필 세기</strong>
                <small>책상 위 연필 개수</small>
              </span>
            </button>
            <button class="station-button" data-puzzle="memory" type="button">
              <span class="station-emoji">✨</span>
              <span class="station-text">
                <strong>기억 퍼즐</strong>
                <small>빛나는 순서 기억하기</small>
              </span>
            </button>
            <button class="door-button" type="button">
              <span class="station-emoji">🚪</span>
              <span class="station-text">
                <strong>무지개 문 열기</strong>
                <small>별 조각 4개가 모이면 열림</small>
              </span>
            </button>
          </section>

          <div class="modal-backdrop is-hidden">
            <section class="modal-card">
              <header class="modal-header">
                <h2 class="modal-title"></h2>
                <button class="modal-close" type="button" aria-label="닫기">×</button>
              </header>
              <div class="modal-body"></div>
            </section>
          </div>

          <div class="toast is-hidden" role="status" aria-live="polite"></div>

          <div class="intro-overlay">
            <section class="intro-card">
              <p class="eyebrow">Start Jennyworld</p>
              <h2 class="intro-title">모바일에서 바로 시작할 수 있게 다시 정리했어.</h2>
              <p class="intro-text">아래 퍼즐 버튼을 눌러 별 조각 4개를 모으고 무지개 문을 열면 된다. 가로 화면이 더 보기 좋지만, 세로에서도 바로 시작할 수 있다.</p>
              <div class="intro-row">
                <div class="intro-tip">
                  <strong>플레이 방법</strong>
                  <span>1. 퍼즐 버튼 누르기</span>
                  <span>2. 문제 풀기</span>
                  <span>3. 문 열기</span>
                </div>
                <button class="primary-button intro-start" type="button">게임 시작</button>
              </div>
            </section>
          </div>

          <div class="clear-overlay is-hidden">
            <section class="clear-card">
              <p class="eyebrow">Stage Clear</p>
              <h2 class="clear-title">무지개 교실 탈출 성공</h2>
              <p class="clear-text">별 조각 네 개를 모아 문을 열었다. 다음 스테이지로 이어서 확장할 수 있다.</p>
              <div class="clear-stars" aria-hidden="true">
                <span class="clear-star"></span>
                <span class="clear-star"></span>
                <span class="clear-star"></span>
                <span class="clear-star"></span>
              </div>
              <button class="primary-button clear-replay" type="button">같은 방 다시 하기</button>
            </section>
          </div>
        </div>
      </div>
    `;

    this.canvas = mount.querySelector<HTMLCanvasElement>('.game-canvas')!;
    this.stageNote = mount.querySelector<HTMLDivElement>('.stage-note')!;
    this.stageDock = mount.querySelector<HTMLDivElement>('.stage-dock')!;
    this.objectiveTitle = mount.querySelector<HTMLParagraphElement>('.objective-title')!;
    this.objectiveDetail = mount.querySelector<HTMLParagraphElement>('.objective-detail')!;
    this.starsCount = mount.querySelector<HTMLParagraphElement>('.stars-count')!;
    this.starDots = Array.from(mount.querySelectorAll<HTMLSpanElement>('.star-dot'));
    this.modalBackdrop = mount.querySelector<HTMLDivElement>('.modal-backdrop')!;
    this.modalTitle = mount.querySelector<HTMLHeadingElement>('.modal-title')!;
    this.modalBody = mount.querySelector<HTMLDivElement>('.modal-body')!;
    this.modalClose = mount.querySelector<HTMLButtonElement>('.modal-close')!;
    this.toast = mount.querySelector<HTMLDivElement>('.toast')!;
    this.introOverlay = mount.querySelector<HTMLDivElement>('.intro-overlay')!;
    this.startButton = mount.querySelector<HTMLButtonElement>('.intro-start')!;
    this.clearOverlay = mount.querySelector<HTMLDivElement>('.clear-overlay')!;
    this.replayButton = mount.querySelector<HTMLButtonElement>('.clear-replay')!;
    this.resetButton = mount.querySelector<HTMLButtonElement>('.reset-button')!;
    this.doorButton = mount.querySelector<HTMLButtonElement>('.door-button')!;
    this.puzzleButtons = {
      colors: mount.querySelector<HTMLButtonElement>('[data-puzzle="colors"]')!,
      shapes: mount.querySelector<HTMLButtonElement>('[data-puzzle="shapes"]')!,
      count: mount.querySelector<HTMLButtonElement>('[data-puzzle="count"]')!,
      memory: mount.querySelector<HTMLButtonElement>('[data-puzzle="memory"]')!,
    };

    this.bindEvents();
    this.setProgress(0, 4);
  }

  setHandlers(handlers: OverlayHandlers): void {
    this.handlers = handlers;
  }

  focusCanvas(): void {
    this.canvas.focus?.();
  }

  setProgress(count: number, total: number): void {
    this.starsCount.textContent = `${count} / ${total}`;
    this.starDots.forEach((dot, index) => {
      dot.classList.toggle('is-filled', index < count);
    });
  }

  setObjective(title: string, detail: string): void {
    this.objectiveTitle.textContent = title;
    this.objectiveDetail.textContent = detail;
  }

  setStageState(progress: ProgressState): void {
    let solvedCount = 0;

    (Object.keys(this.puzzleButtons) as PuzzleId[]).forEach((puzzleId) => {
      const solved = progress[puzzleId];
      solvedCount += Number(solved);
      const button = this.puzzleButtons[puzzleId];
      const meta = PUZZLE_BUTTON_META[puzzleId];
      button.classList.toggle('is-solved', solved);
      button.disabled = solved;
      button.querySelector('strong')!.textContent = solved ? `${meta.label} 완료` : meta.label;
      button.querySelector('small')!.textContent = solved ? '별 조각 획득 완료' : button.dataset.puzzle === 'colors'
        ? '빨강, 파랑, 노랑 순서'
        : button.dataset.puzzle === 'shapes'
          ? '원, 세모, 네모 맞추기'
          : button.dataset.puzzle === 'count'
            ? '책상 위 연필 개수'
            : '빛나는 순서 기억하기';
    });

    const canOpenDoor = solvedCount === 4 && !progress.cleared;
    this.doorButton.disabled = !canOpenDoor;
    this.doorButton.classList.toggle('is-ready', canOpenDoor);
    this.doorButton.classList.toggle('is-solved', progress.cleared);
    this.doorButton.querySelector('strong')!.textContent = progress.cleared ? '문 열기 완료' : '무지개 문 열기';
    this.doorButton.querySelector('small')!.textContent = progress.cleared
      ? '스테이지 클리어'
      : canOpenDoor
        ? '별 조각이 다 모였다'
        : '별 조각 4개가 모이면 열림';
  }

  showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.remove('is-hidden');

    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }

    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.add('is-hidden');
      this.toastTimer = null;
    }, 2400);
  }

  showDoorLocked(missingStars: number): void {
    this.showToast(`별 조각이 ${missingStars}개 더 필요해.`);
  }

  showClear(): void {
    this.clearOverlay.classList.remove('is-hidden');
  }

  hideClear(): void {
    this.clearOverlay.classList.add('is-hidden');
  }

  openPuzzle(puzzleId: PuzzleId, onSolved: () => void): void {
    const definition = PUZZLE_DEFINITIONS[puzzleId];
    this.clearTimers();
    this.stageNote.classList.add('is-hidden-ui');
    this.stageDock.classList.add('is-hidden-ui');
    this.modalBackdrop.classList.remove('is-hidden');
    this.modalTitle.textContent = definition.title;
    this.modalClose.hidden = false;

    switch (puzzleId) {
      case 'colors':
        this.renderColorPuzzle(onSolved);
        break;
      case 'shapes':
        this.renderShapePuzzle(onSolved);
        break;
      case 'count':
        this.renderCountingPuzzle(onSolved);
        break;
      case 'memory':
        this.renderMemoryPuzzle(onSolved);
        break;
    }
  }

  closeModal(): void {
    this.clearTimers();
    this.stageNote.classList.remove('is-hidden-ui');
    this.stageDock.classList.remove('is-hidden-ui');
    this.modalBackdrop.classList.add('is-hidden');
    this.modalBody.replaceChildren();
  }

  private bindEvents(): void {
    this.modalClose.addEventListener('click', () => {
      this.closeModal();
    });

    this.startButton.addEventListener('click', () => {
      this.introOverlay.classList.add('is-hidden');
      this.handlers.onStart?.();
      this.focusCanvas();
    });

    this.replayButton.addEventListener('click', () => {
      this.hideClear();
      this.handlers.onReset?.();
    });

    this.resetButton.addEventListener('click', () => {
      this.hideClear();
      this.closeModal();
      this.handlers.onReset?.();
    });

    this.doorButton.addEventListener('click', () => {
      this.handlers.onOpenDoor?.();
    });

    (Object.keys(this.puzzleButtons) as PuzzleId[]).forEach((puzzleId) => {
      this.puzzleButtons[puzzleId].addEventListener('click', () => {
        this.handlers.onOpenPuzzle?.(puzzleId);
      });
    });

    this.modalBackdrop.addEventListener('click', (event) => {
      if (event.target === this.modalBackdrop) {
        this.closeModal();
      }
    });
  }

  private renderColorPuzzle(onSolved: () => void): void {
    const definition = PUZZLE_DEFINITIONS.colors;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const preview = document.createElement('div');
    preview.className = 'sequence-preview';

    const previewSlots = COLOR_SEQUENCE.map(() => {
      const slot = document.createElement('div');
      slot.className = 'sequence-slot';
      preview.append(slot);
      return slot;
    });

    const buttonGrid = document.createElement('div');
    buttonGrid.className = 'color-grid';
    let progress = 0;
    const feedback = this.createFeedback(`${COLOR_SEQUENCE.length}개의 버튼을 차례대로 눌러 보자.`);

    const updatePreview = (): void => {
      previewSlots.forEach((slot, index) => {
        const color = COLOR_SEQUENCE[index];
        const isFilled = index < progress;
        slot.classList.toggle('is-filled', isFilled);
        slot.textContent = isFilled ? COLOR_LABELS[color] : '?';
        slot.style.background = isFilled ? COLOR_HEX[color] : '';
      });
    };

    COLOR_SEQUENCE.forEach((color) => {
      const button = document.createElement('button');
      button.className = 'puzzle-button';
      button.type = 'button';
      button.dataset.color = color;
      button.textContent = COLOR_LABELS[color];
      button.addEventListener('click', () => {
        if (COLOR_SEQUENCE[progress] === color) {
          progress += 1;
          feedback.textContent = `${COLOR_LABELS[color]} 좋아!`;
          updatePreview();
          if (progress === COLOR_SEQUENCE.length) {
            onSolved();
            this.renderSolvedState(definition.success);
          }
          return;
        }

        progress = 0;
        updatePreview();
        feedback.textContent = '순서가 달라. 다시 천천히 눌러 보자.';
      });
      buttonGrid.append(button);
    });

    updatePreview();
    wrapper.append(preview, buttonGrid, feedback);
    this.modalBody.replaceChildren(wrapper);
  }

  private renderShapePuzzle(onSolved: () => void): void {
    const definition = PUZZLE_DEFINITIONS.shapes;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const targets = document.createElement('div');
    targets.className = 'shape-grid';

    SHAPE_ORDER.forEach((shape) => {
      const target = document.createElement('div');
      target.className = 'shape-target';
      target.innerHTML = `<strong>${SHAPE_SYMBOLS[shape]}</strong>${SHAPE_LABELS[shape]}`;
      targets.append(target);
    });

    const slots = document.createElement('div');
    slots.className = 'shape-grid';
    const currentShapes: ShapeButton[] = ['triangle', 'square', 'circle'];
    const feedback = this.createFeedback('칸을 눌러서 원하는 도형으로 바꿔 보자.');

    const cycleShape = (shape: ShapeButton): ShapeButton => {
      if (shape === 'circle') return 'triangle';
      if (shape === 'triangle') return 'square';
      return 'circle';
    };

    const updateSlots = (): void => {
      slotButtons.forEach((button, index) => {
        const shape = currentShapes[index];
        button.textContent = SHAPE_SYMBOLS[shape];
        button.setAttribute('aria-label', SHAPE_LABELS[shape]);
      });
    };

    const slotButtons = currentShapes.map((shape, index) => {
      const button = document.createElement('button');
      button.className = 'shape-slot';
      button.type = 'button';
      button.textContent = SHAPE_SYMBOLS[shape];
      button.addEventListener('click', () => {
        currentShapes[index] = cycleShape(currentShapes[index]);
        updateSlots();
        if (currentShapes.every((current, currentIndex) => current === SHAPE_ORDER[currentIndex])) {
          onSolved();
          this.renderSolvedState(definition.success);
        } else {
          feedback.textContent = '도형이 맞아 가고 있어. 목표 칸을 확인하자.';
        }
      });
      slots.append(button);
      return button;
    });

    updateSlots();
    wrapper.append(targets, slots, feedback);
    this.modalBody.replaceChildren(wrapper);
  }

  private renderCountingPuzzle(onSolved: () => void): void {
    const definition = PUZZLE_DEFINITIONS.count;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const note = document.createElement('div');
    note.className = 'puzzle-note';
    note.textContent = '방 안에서 보이는 노란 연필은 모두 몇 개일까?';

    const choices = document.createElement('div');
    choices.className = 'choice-grid';
    const feedback = this.createFeedback('숫자를 하나 골라 보자.');

    COUNTING_OPTIONS.forEach((value) => {
      const button = document.createElement('button');
      button.className = 'choice-button';
      button.type = 'button';
      button.textContent = `${value}`;
      button.addEventListener('click', () => {
        if (value === COUNTING_ANSWER) {
          onSolved();
          this.renderSolvedState(definition.success);
        } else {
          feedback.textContent = '다시 한 번 천천히 세어 보자.';
        }
      });
      choices.append(button);
    });

    wrapper.append(note, choices, feedback);
    this.modalBody.replaceChildren(wrapper);
  }

  private renderMemoryPuzzle(onSolved: () => void): void {
    const definition = PUZZLE_DEFINITIONS.memory;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const status = document.createElement('div');
    status.className = 'memory-status';
    status.textContent = '빛나는 순서를 먼저 보여 줄게.';

    const buttons = document.createElement('div');
    buttons.className = 'memory-grid';
    const buttonMap = new Map<MemoryButton, HTMLButtonElement>();
    let progress = 0;
    let isPlayback = true;

    const replay = document.createElement('button');
    replay.className = 'secondary-button';
    replay.type = 'button';
    replay.textContent = '다시 보기';

    const feedback = this.createFeedback('눈으로 보고, 같은 순서로 눌러 보자.');

    const playSequence = (): void => {
      this.clearTimers();
      progress = 0;
      isPlayback = true;
      status.textContent = '빛나는 순서를 기억해 보자.';
      feedback.textContent = '먼저 보여 주는 중이야.';
      buttonMap.forEach((button) => {
        button.disabled = true;
        button.classList.remove('is-flashing');
      });

      let delay = 450;
      MEMORY_SEQUENCE.forEach((color) => {
        const button = buttonMap.get(color);
        if (!button) {
          return;
        }

        const flashStart = window.setTimeout(() => {
          button.classList.add('is-flashing');
        }, delay);
        const flashEnd = window.setTimeout(() => {
          button.classList.remove('is-flashing');
        }, delay + 340);
        this.activeTimers.push(flashStart, flashEnd);
        delay += 620;
      });

      const finish = window.setTimeout(() => {
        isPlayback = false;
        status.textContent = '이제 같은 순서로 눌러 보자.';
        feedback.textContent = '핑크, 하늘, 노랑 중 어떤 순서였을까?';
        buttonMap.forEach((button) => {
          button.disabled = false;
        });
      }, delay + 120);
      this.activeTimers.push(finish);
    };

    MEMORY_SEQUENCE.forEach((color) => {
      const button = document.createElement('button');
      button.className = 'memory-button';
      button.type = 'button';
      button.dataset.color = color;
      button.textContent = MEMORY_LABELS[color];
      button.addEventListener('click', () => {
        if (isPlayback) return;
        if (MEMORY_SEQUENCE[progress] === color) {
          progress += 1;
          feedback.textContent = `${MEMORY_LABELS[color]} 좋아!`;
          if (progress === MEMORY_SEQUENCE.length) {
            onSolved();
            this.renderSolvedState(definition.success);
          }
          return;
        }

        progress = 0;
        feedback.textContent = '순서가 달라. 다시 보고 도전하자.';
        playSequence();
      });
      buttons.append(button);
      buttonMap.set(color, button);
    });

    replay.addEventListener('click', () => {
      playSequence();
    });

    wrapper.append(status, buttons, feedback, replay);
    this.modalBody.replaceChildren(wrapper);
    playSequence();
  }

  private createPuzzleWrapper(subtitle: string, hint: string): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-body';

    const subtitleNode = document.createElement('p');
    subtitleNode.className = 'modal-text';
    subtitleNode.textContent = subtitle;

    const hintNode = document.createElement('div');
    hintNode.className = 'hint-box';
    hintNode.textContent = `힌트: ${hint}`;

    wrapper.append(subtitleNode, hintNode);
    return wrapper;
  }

  private createFeedback(initialText: string): HTMLDivElement {
    const feedback = document.createElement('div');
    feedback.className = 'feedback-chip';
    feedback.textContent = initialText;
    return feedback;
  }

  private renderSolvedState(message: string): void {
    this.clearTimers();
    this.modalClose.hidden = true;
    const success = document.createElement('div');
    success.className = 'success-box';
    success.textContent = message;

    const followUp = document.createElement('p');
    followUp.className = 'modal-text';
    followUp.textContent = '별 조각이 인벤토리에 들어갔다. 아래 버튼으로 다음 퍼즐을 열자.';

    const closeButton = document.createElement('button');
    closeButton.className = 'primary-button';
    closeButton.type = 'button';
    closeButton.textContent = '계속하기';
    closeButton.addEventListener('click', () => {
      this.closeModal();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'modal-body';
    wrapper.append(success, followUp, closeButton);
    this.modalBody.replaceChildren(wrapper);
  }

  private clearTimers(): void {
    this.activeTimers.forEach((timer) => {
      window.clearTimeout(timer);
    });
    this.activeTimers = [];
  }
}
