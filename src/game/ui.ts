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
import type { PromptState, PuzzleId } from './types';

interface OverlayHandlers {
  onAction?: () => void;
  onReset?: () => void;
}

type MoveVector = {
  x: number;
  y: number;
};

type LookDelta = {
  x: number;
  y: number;
};

export class OverlayUI {
  readonly canvas: HTMLCanvasElement;

  private handlers: OverlayHandlers = {};
  private readonly objectiveTitle: HTMLParagraphElement;
  private readonly objectiveDetail: HTMLParagraphElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly promptPanel: HTMLDivElement;
  private readonly promptTitle: HTMLParagraphElement;
  private readonly promptDetail: HTMLParagraphElement;
  private readonly starsCount: HTMLParagraphElement;
  private readonly starDots: HTMLSpanElement[];
  private readonly modalBackdrop: HTMLDivElement;
  private readonly modalTitle: HTMLHeadingElement;
  private readonly modalBody: HTMLDivElement;
  private readonly modalClose: HTMLButtonElement;
  private readonly toast: HTMLDivElement;
  private readonly clearOverlay: HTMLDivElement;
  private readonly replayButton: HTMLButtonElement;
  private readonly joystick: HTMLDivElement;
  private readonly joystickKnob: HTMLDivElement;
  private readonly lookZone: HTMLDivElement;
  private readonly jumpButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private moveVector: MoveVector = { x: 0, y: 0 };
  private lookDelta: LookDelta = { x: 0, y: 0 };
  private joystickPointerId: number | null = null;
  private lookPointerId: number | null = null;
  private lastLookPoint: { x: number; y: number } | null = null;
  private jumpQueued = false;
  private toastTimer: number | null = null;
  private activeTimers: number[] = [];
  private modalVisible = false;
  private clearVisible = false;

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

          <section class="hud-card objective-card">
            <p class="objective-title">별 조각을 모으자</p>
            <p class="objective-detail">조이스틱으로 움직이고, 오브젝트 가까이 가면 상호작용 버튼이 나타난다.</p>
          </section>

          <section class="hud-card prompt-panel is-hidden">
            <p class="prompt-label">근처 상호작용</p>
            <p class="prompt-title"></p>
            <p class="prompt-detail"></p>
          </section>

          <button class="action-button is-hidden" type="button">상호작용</button>

          <div class="joystick" aria-label="이동 조이스틱" role="presentation">
            <div class="joystick-knob"></div>
          </div>

          <div class="control-cluster">
            <button class="jump-button" type="button">점프</button>
            <div class="look-zone" aria-label="시점 조작 영역">
              <span>시점 드래그</span>
            </div>
          </div>

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

          <div class="clear-overlay is-hidden">
            <section class="clear-card">
              <p class="eyebrow">Stage Clear</p>
              <h2 class="clear-title">무지개 교실 탈출 성공</h2>
              <p class="clear-text">별 조각 네 개를 모아 문을 열었다. 다음에는 캔디 놀이터를 만들 수 있다.</p>
              <div class="clear-stars" aria-hidden="true">
                <span class="clear-star"></span>
                <span class="clear-star"></span>
                <span class="clear-star"></span>
                <span class="clear-star"></span>
              </div>
              <div class="button-row" style="justify-content:center">
                <button class="primary-button clear-replay" type="button">같은 방 다시 하기</button>
              </div>
            </section>
          </div>
        </div>
      </div>
    `;

    this.canvas = mount.querySelector<HTMLCanvasElement>('.game-canvas')!;
    this.objectiveTitle = mount.querySelector<HTMLParagraphElement>('.objective-title')!;
    this.objectiveDetail = mount.querySelector<HTMLParagraphElement>('.objective-detail')!;
    this.actionButton = mount.querySelector<HTMLButtonElement>('.action-button')!;
    this.promptPanel = mount.querySelector<HTMLDivElement>('.prompt-panel')!;
    this.promptTitle = mount.querySelector<HTMLParagraphElement>('.prompt-title')!;
    this.promptDetail = mount.querySelector<HTMLParagraphElement>('.prompt-detail')!;
    this.starsCount = mount.querySelector<HTMLParagraphElement>('.stars-count')!;
    this.starDots = Array.from(mount.querySelectorAll<HTMLSpanElement>('.star-dot'));
    this.modalBackdrop = mount.querySelector<HTMLDivElement>('.modal-backdrop')!;
    this.modalTitle = mount.querySelector<HTMLHeadingElement>('.modal-title')!;
    this.modalBody = mount.querySelector<HTMLDivElement>('.modal-body')!;
    this.modalClose = mount.querySelector<HTMLButtonElement>('.modal-close')!;
    this.toast = mount.querySelector<HTMLDivElement>('.toast')!;
    this.clearOverlay = mount.querySelector<HTMLDivElement>('.clear-overlay')!;
    this.replayButton = mount.querySelector<HTMLButtonElement>('.clear-replay')!;
    this.joystick = mount.querySelector<HTMLDivElement>('.joystick')!;
    this.joystickKnob = mount.querySelector<HTMLDivElement>('.joystick-knob')!;
    this.lookZone = mount.querySelector<HTMLDivElement>('.look-zone')!;
    this.jumpButton = mount.querySelector<HTMLButtonElement>('.jump-button')!;
    this.resetButton = mount.querySelector<HTMLButtonElement>('.reset-button')!;

    this.bindEvents();
    this.setProgress(0, 4);
  }

  setHandlers(handlers: OverlayHandlers): void {
    this.handlers = handlers;
  }

  focusCanvas(): void {
    this.canvas.focus?.();
  }

  getMoveVector(): MoveVector {
    return this.moveVector;
  }

  consumeLookDelta(): LookDelta {
    const current = { ...this.lookDelta };
    this.lookDelta = { x: 0, y: 0 };
    return current;
  }

  consumeJumpRequest(): boolean {
    const shouldJump = this.jumpQueued;
    this.jumpQueued = false;
    return shouldJump;
  }

  isBlockingGame(): boolean {
    return this.modalVisible || this.clearVisible;
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

  setPrompt(prompt: PromptState | null): void {
    if (!prompt || this.isBlockingGame()) {
      this.promptPanel.classList.add('is-hidden');
      this.actionButton.classList.add('is-hidden');
      return;
    }

    this.promptTitle.textContent = prompt.title;
    this.promptDetail.textContent = prompt.detail;
    this.actionButton.textContent = prompt.actionLabel;
    this.promptPanel.classList.remove('is-hidden');
    this.actionButton.classList.remove('is-hidden');
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
    this.clearVisible = true;
    this.clearOverlay.classList.remove('is-hidden');
    this.setPrompt(null);
  }

  hideClear(): void {
    this.clearVisible = false;
    this.clearOverlay.classList.add('is-hidden');
  }

  openPuzzle(puzzleId: PuzzleId, onSolved: () => void): void {
    const definition = PUZZLE_DEFINITIONS[puzzleId];
    this.clearTimers();
    this.modalVisible = true;
    this.modalBackdrop.classList.remove('is-hidden');
    this.modalTitle.textContent = definition.title;
    this.modalClose.hidden = false;
    this.setPrompt(null);

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
    this.modalVisible = false;
    this.modalBackdrop.classList.add('is-hidden');
    this.modalBody.replaceChildren();
  }

  private bindEvents(): void {
    this.actionButton.addEventListener('click', () => {
      this.handlers.onAction?.();
    });

    this.modalClose.addEventListener('click', () => {
      this.closeModal();
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

    this.modalBackdrop.addEventListener('click', (event) => {
      if (event.target === this.modalBackdrop) {
        this.closeModal();
      }
    });

    this.joystick.addEventListener('pointerdown', (event) => {
      this.joystickPointerId = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      this.updateJoystick(event.clientX, event.clientY);
    });

    this.joystick.addEventListener('pointermove', (event) => {
      if (this.joystickPointerId !== event.pointerId) {
        return;
      }

      this.updateJoystick(event.clientX, event.clientY);
    });

    const releaseJoystick = (event: PointerEvent) => {
      if (this.joystickPointerId !== event.pointerId) {
        return;
      }

      this.joystickPointerId = null;
      this.moveVector = { x: 0, y: 0 };
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    };

    this.joystick.addEventListener('pointerup', releaseJoystick);
    this.joystick.addEventListener('pointercancel', releaseJoystick);

    this.lookZone.addEventListener('pointerdown', (event) => {
      this.lookPointerId = event.pointerId;
      this.lookZone.setPointerCapture(event.pointerId);
      this.lastLookPoint = { x: event.clientX, y: event.clientY };
    });

    this.lookZone.addEventListener('pointermove', (event) => {
      if (this.lookPointerId !== event.pointerId || !this.lastLookPoint) {
        return;
      }

      this.lookDelta.x += event.clientX - this.lastLookPoint.x;
      this.lookDelta.y += event.clientY - this.lastLookPoint.y;
      this.lastLookPoint = { x: event.clientX, y: event.clientY };
    });

    const releaseLook = (event: PointerEvent) => {
      if (this.lookPointerId !== event.pointerId) {
        return;
      }

      this.lookPointerId = null;
      this.lastLookPoint = null;
    };

    this.lookZone.addEventListener('pointerup', releaseLook);
    this.lookZone.addEventListener('pointercancel', releaseLook);

    this.jumpButton.addEventListener('click', () => {
      this.jumpQueued = true;
    });
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const rect = this.joystick.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance > radius) {
      const scale = radius / distance;
      dx *= scale;
      dy *= scale;
    }

    this.moveVector = {
      x: Number((dx / radius).toFixed(3)),
      y: Number((dy / radius).toFixed(3)),
    };

    this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
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
      if (shape === 'circle') {
        return 'triangle';
      }
      if (shape === 'triangle') {
        return 'square';
      }
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
    note.textContent = '교실 뒤쪽 책상 위에 있는 노란 연필 꾸러미를 세어 보자.';

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
        if (isPlayback) {
          return;
        }

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
    followUp.textContent = '별 조각이 인벤토리에 들어갔다. 계속 탐험하자.';

    const closeButton = document.createElement('button');
    closeButton.className = 'primary-button';
    closeButton.type = 'button';
    closeButton.textContent = '계속 탐험하기';
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
