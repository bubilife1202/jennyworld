import {
  COLOR_HEX,
  COLOR_LABELS,
  COLOR_SEQUENCE,
  COUNTING_ANSWER,
  COUNTING_OPTIONS,
  FINAL_DOOR_ANSWER,
  FINAL_DOOR_COLOR_CHOICES,
  FINAL_DOOR_NOTE_CHOICES,
  FINAL_DOOR_SHAPE_CHOICES,
  MEMORY_HEX,
  MEMORY_LABELS,
  MEMORY_SEQUENCE,
  PUZZLE_DEFINITIONS,
  PUZZLE_IDS,
  RHYTHM_LABELS,
  RHYTHM_SEQUENCE,
  SHAPE_LABELS,
  SHAPE_ORDER,
  SHAPE_SYMBOLS,
  STAGE_SUBTITLE,
  STAGE_TITLE,
  SWITCH_TARGET,
  STAGE_2_COLOR_SEQUENCE,
  STAGE_2_SHAPE_ORDER,
  STAGE_2_COUNTING_OPTIONS,
  STAGE_2_COUNTING_ANSWER,
  STAGE_2_MEMORY_SEQUENCE,
  STAGE_2_RHYTHM_SEQUENCE,
  STAGE_2_SWITCH_TARGET,
  STAGE_2_DEFINITIONS,
  STAGE_2_FINAL_DOOR_ANSWER,
  SWITCH_LINKED,
  STAGE_2_SWITCH_LINKED,
  type MemoryButton,
  type ShapeButton,
  type RhythmButton,
} from './puzzles';
import type { PromptState, PuzzleId } from './types';

interface OverlayHandlers {
  onAction?: () => void;
  onReset?: () => void;
  onNextStage?: () => void;
}

type MoveVector = {
  x: number;
  y: number;
};

type LookDelta = {
  x: number;
  y: number;
};

interface ChecklistItem {
  label: string;
  zone: string;
  solved: boolean;
}

interface MinimapState {
  zoneLabel: string;
  player: { x: number; y: number };
  target?: { x: number; y: number } | null;
  markers: Array<{ x: number; y: number; solved: boolean }>;
}

type SecondaryPanelKey = 'checklist' | 'minimap' | 'ability';

interface SecondaryPanelBinding {
  key: SecondaryPanelKey;
  element: HTMLDetailsElement;
  summary: HTMLElement;
  label: string;
}

export class OverlayUI {
  readonly canvas: HTMLCanvasElement;

  private handlers: OverlayHandlers = {};
  private readonly objectiveTitle: HTMLParagraphElement;
  private readonly objectiveDetail: HTMLParagraphElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly promptPanel: HTMLDivElement;
  private readonly promptTitle: HTMLParagraphElement;
  private readonly promptDetail: HTMLParagraphElement;
  private readonly zoneChip: HTMLParagraphElement;
  private readonly zoneBanner: HTMLDivElement;
  private readonly trackerPanel: HTMLDetailsElement;
  private readonly trackerSummary: HTMLElement;
  private readonly trackerList: HTMLDivElement;
  private readonly minimapPanel: HTMLDetailsElement;
  private readonly minimapSummary: HTMLElement;
  private readonly minimapField: HTMLDivElement;
  private readonly minimapCaption: HTMLParagraphElement;
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
  private readonly abilityPanel: HTMLDetailsElement;
  private readonly abilitySummary: HTMLElement;
  private readonly jumpButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly nextStageButton: HTMLButtonElement;
  private readonly transitionOverlay: HTMLDivElement;
  private readonly transitionText: HTMLParagraphElement;
  private readonly secondaryPanels: SecondaryPanelBinding[];
  private readonly windowKeydownHandler = (event: KeyboardEvent): void => {
    if (event.repeat || event.code !== 'Space') {
      return;
    }

    event.preventDefault();
    this.queueJump();
  };
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
  private activeSecondaryPanel: SecondaryPanelKey | null = 'ability';
  private secondaryPanelBeforeModal: SecondaryPanelKey | null = null;
  private syncingSecondaryPanels = false;
  private currentStage: 1 | 2 = 1;

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
                <p class="stars-count">0 / ${PUZZLE_IDS.length}</p>
                <div class="stars-strip" aria-hidden="true">
                  ${Array.from({ length: PUZZLE_IDS.length }, () => '<span class="star-dot"></span>').join('')}
                </div>
              </section>
              <button class="reset-button" type="button">다시 시작</button>
            </div>
          </div>

          <section class="hud-card objective-card">
            <p class="objective-title">앞쪽 교실 단서를 모으자</p>
            <p class="objective-detail">남쪽 교실 세 구역부터 탐색하고, 중간 통로를 지나 뒤쪽 연구 구역으로 나아가자.</p>
          </section>

          <p class="zone-chip">앞 교실</p>
          <div class="zone-banner is-hidden"></div>

          <details class="hud-card tracker-card">
            <summary class="tracker-summary">탐험 체크 펼치기</summary>
            <div class="tracker-list"></div>
          </details>

          <details class="hud-card minimap-card">
            <summary class="minimap-summary">미니맵 펼치기</summary>
            <div class="minimap-field"></div>
            <p class="minimap-caption">앞 교실</p>
          </details>

          <section class="hud-card prompt-panel is-hidden">
            <p class="prompt-label">근처 상호작용</p>
            <p class="prompt-title"></p>
            <p class="prompt-detail"></p>
          </section>

          <button class="action-button is-hidden" type="button">상호작용</button>

          <div class="joystick" aria-label="이동 조이스틱" role="presentation">
            <div class="joystick-knob"></div>
          </div>

          <details class="hud-card control-cluster ability-panel" open>
            <summary class="ability-summary">점프 접기</summary>
            <button class="jump-button" type="button">점프</button>
          </details>

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

          <div class="stage-transition is-hidden">
            <p class="transition-text"></p>
          </div>

          <div class="clear-overlay is-hidden">
            <section class="clear-card">
              <p class="eyebrow">Stage Clear</p>
              <h2 class="clear-title">${STAGE_TITLE} 돌파 성공</h2>
              <p class="clear-text">별 조각 여섯 개를 모아 돌파 성공! 다음 방이 기다리고 있다.</p>
              <div class="clear-stars" aria-hidden="true">
                ${Array.from({ length: PUZZLE_IDS.length }, () => '<span class="clear-star"></span>').join('')}
              </div>
              <div class="button-row" style="justify-content:center;gap:12px">
                <button class="primary-button clear-next" type="button">별빛 정원으로 이동</button>
                <button class="secondary-button clear-replay" type="button">같은 방 다시 하기</button>
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
    this.zoneChip = mount.querySelector<HTMLParagraphElement>('.zone-chip')!;
    this.zoneBanner = mount.querySelector<HTMLDivElement>('.zone-banner')!;
    this.trackerPanel = mount.querySelector<HTMLDetailsElement>('.tracker-card')!;
    this.trackerSummary = mount.querySelector<HTMLElement>('.tracker-summary')!;
    this.trackerList = mount.querySelector<HTMLDivElement>('.tracker-list')!;
    this.minimapPanel = mount.querySelector<HTMLDetailsElement>('.minimap-card')!;
    this.minimapSummary = mount.querySelector<HTMLElement>('.minimap-summary')!;
    this.minimapField = mount.querySelector<HTMLDivElement>('.minimap-field')!;
    this.minimapCaption = mount.querySelector<HTMLParagraphElement>('.minimap-caption')!;
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
    this.abilityPanel = mount.querySelector<HTMLDetailsElement>('.ability-panel')!;
    this.abilitySummary = mount.querySelector<HTMLElement>('.ability-summary')!;
    this.jumpButton = mount.querySelector<HTMLButtonElement>('.jump-button')!;
    this.resetButton = mount.querySelector<HTMLButtonElement>('.reset-button')!;
    this.nextStageButton = mount.querySelector<HTMLButtonElement>('.clear-next')!;
    this.transitionOverlay = mount.querySelector<HTMLDivElement>('.stage-transition')!;
    this.transitionText = mount.querySelector<HTMLParagraphElement>('.transition-text')!;

    this.trackerPanel.style.display = 'block';
    this.minimapPanel.style.display = 'block';
    this.abilityPanel.style.pointerEvents = 'auto';

    this.secondaryPanels = [
      { key: 'checklist', element: this.trackerPanel, summary: this.trackerSummary, label: '탐험 체크' },
      { key: 'minimap', element: this.minimapPanel, summary: this.minimapSummary, label: '미니맵' },
      { key: 'ability', element: this.abilityPanel, summary: this.abilitySummary, label: '점프' },
    ];

    this.bindEvents();
    this.setActiveSecondaryPanel(this.activeSecondaryPanel);
    this.setProgress(0, PUZZLE_IDS.length);
  }

  setHandlers(handlers: OverlayHandlers): void {
    this.handlers = handlers;
  }

  setStage(stage: 1 | 2): void {
    this.currentStage = stage;
  }

  private get stageColorSequence() {
    return this.currentStage === 1 ? COLOR_SEQUENCE : STAGE_2_COLOR_SEQUENCE;
  }
  private get stageShapeOrder() {
    return this.currentStage === 1 ? SHAPE_ORDER : STAGE_2_SHAPE_ORDER;
  }
  private get stageCountingOptions(): readonly number[] {
    return this.currentStage === 1 ? COUNTING_OPTIONS : STAGE_2_COUNTING_OPTIONS;
  }
  private get stageCountingAnswer(): number {
    return this.currentStage === 1 ? COUNTING_ANSWER : STAGE_2_COUNTING_ANSWER;
  }
  private get stageMemorySequence() {
    return this.currentStage === 1 ? MEMORY_SEQUENCE : STAGE_2_MEMORY_SEQUENCE;
  }
  private get stageRhythmSequence(): readonly RhythmButton[] {
    return this.currentStage === 1 ? RHYTHM_SEQUENCE : STAGE_2_RHYTHM_SEQUENCE;
  }
  private get stageSwitchTarget(): readonly boolean[] {
    return this.currentStage === 1 ? SWITCH_TARGET : STAGE_2_SWITCH_TARGET;
  }
  private get stageSwitchLinked(): boolean {
    return this.currentStage === 1 ? SWITCH_LINKED : STAGE_2_SWITCH_LINKED;
  }
  private get stagePuzzleDefs() {
    return this.currentStage === 1 ? PUZZLE_DEFINITIONS : STAGE_2_DEFINITIONS;
  }
  private get stageFinalDoorAnswer() {
    return this.currentStage === 1 ? FINAL_DOOR_ANSWER : STAGE_2_FINAL_DOOR_ANSWER;
  }

  focusCanvas(): void {
    this.canvas.focus?.();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.windowKeydownHandler);
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

  queueJump(): void {
    this.jumpQueued = true;
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

  setZoneLabel(label: string): void {
    this.zoneChip.textContent = label;
  }

  showZoneBanner(label: string): void {
    this.zoneBanner.textContent = `${label} 진입`;
    this.zoneBanner.classList.remove('is-hidden');

    const timer = window.setTimeout(() => {
      this.zoneBanner.classList.add('is-hidden');
    }, 1200);
    this.activeTimers.push(timer);
  }

  setChecklist(items: ChecklistItem[]): void {
    this.trackerList.replaceChildren(
      ...items.map((item) => {
        const row = document.createElement('div');
        row.className = 'tracker-item';
        row.innerHTML = `
          <span class="tracker-dot ${item.solved ? 'is-solved' : ''}"></span>
          <div class="tracker-copy">
            <strong>${item.label}</strong>
            <span>${item.zone}</span>
          </div>
        `;
        return row;
      }),
    );
  }

  setMinimap(state: MinimapState): void {
    this.minimapCaption.textContent = state.zoneLabel;

    const children: HTMLElement[] = [];
    state.markers.forEach((marker) => {
      const dot = document.createElement('div');
      dot.className = `minimap-dot ${marker.solved ? 'is-solved' : ''}`;
      dot.style.left = `${marker.x}%`;
      dot.style.top = `${marker.y}%`;
      children.push(dot);
    });

    if (state.target) {
      const target = document.createElement('div');
      target.className = 'minimap-target';
      target.style.left = `${state.target.x}%`;
      target.style.top = `${state.target.y}%`;
      children.push(target);
    }

    const player = document.createElement('div');
    player.className = 'minimap-player';
    player.style.left = `${state.player.x}%`;
    player.style.top = `${state.player.y}%`;
    children.push(player);

    this.minimapField.replaceChildren(...children);
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

  showResearchGateLocked(missingStars: number): void {
    this.showToast(`연구 구역으로 가려면 앞 교실 별 조각이 ${missingStars}개 더 필요해.`);
  }

  showClear(): void {
    this.clearVisible = true;
    this.clearOverlay.classList.remove('is-hidden');
    this.collapseSecondaryPanelsForModal();
    this.setPrompt(null);
  }

  hideClear(): void {
    this.clearVisible = false;
    this.clearOverlay.classList.add('is-hidden');
    this.restoreSecondaryPanelsAfterModal();
  }

  showTransition(text: string): Promise<void> {
    this.transitionText.textContent = text;
    this.transitionOverlay.classList.remove('is-hidden');
    this.transitionOverlay.classList.add('is-fading-in');
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        resolve();
      }, 600);
      this.activeTimers.push(timer);
    });
  }

  hideTransition(): void {
    this.transitionOverlay.classList.remove('is-fading-in');
    this.transitionOverlay.classList.add('is-fading-out');
    const timer = window.setTimeout(() => {
      this.transitionOverlay.classList.add('is-hidden');
      this.transitionOverlay.classList.remove('is-fading-out');
    }, 600);
    this.activeTimers.push(timer);
  }

  updateBrandTitle(title: string, subtitle: string): void {
    const brandTitle = this.canvas.closest('.game-shell')?.querySelector<HTMLHeadingElement>('.brand-title');
    const brandSubtitle = this.canvas.closest('.game-shell')?.querySelector<HTMLParagraphElement>('.brand-subtitle');
    if (brandTitle) {
      brandTitle.textContent = title;
    }
    if (brandSubtitle) {
      brandSubtitle.textContent = subtitle;
    }
  }

  updateClearText(title: string, text: string, nextLabel: string): void {
    const clearTitle = this.clearOverlay.querySelector<HTMLHeadingElement>('.clear-title');
    const clearText = this.clearOverlay.querySelector<HTMLParagraphElement>('.clear-text');
    if (clearTitle) {
      clearTitle.textContent = title;
    }
    if (clearText) {
      clearText.textContent = text;
    }
    this.nextStageButton.textContent = nextLabel;
  }

  openPuzzle(puzzleId: PuzzleId, onSolved: () => void): void {
    const definition = this.stagePuzzleDefs[puzzleId];
    this.clearTimers();
    this.modalVisible = true;
    this.modalBackdrop.classList.remove('is-hidden');
    this.modalTitle.textContent = definition.title;
    this.modalClose.hidden = false;
    this.collapseSecondaryPanelsForModal();
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
      case 'rhythm':
        this.renderRhythmPuzzle(onSolved);
        break;
      case 'switches':
        this.renderSwitchPuzzle(onSolved);
        break;
    }
  }

  openFinalDoorExam(onSolved: () => void): void {
    this.clearTimers();
    this.modalVisible = true;
    this.modalBackdrop.classList.remove('is-hidden');
    this.modalTitle.textContent = '최종 문 재조합 시험';
    this.modalClose.hidden = false;
    this.collapseSecondaryPanelsForModal();
    this.setPrompt(null);

    const wrapper = this.createPuzzleWrapper(
      '앞 교실과 연구 구역에서 봤던 단서를 다시 조합해 문 코드를 완성하자.',
      '네 번째 색, 마지막 도형, 세 번째 음을 떠올려 보자.',
    );
    const sections = document.createElement('div');
    sections.className = 'choice-grid';
    const selections: { color: string | null; shape: string | null; note: string | null } = {
      color: null,
      shape: null,
      note: null,
    };

    const feedback = this.createFeedback('세 칸을 모두 선택한 뒤 문을 해제하자.');
    const confirm = document.createElement('button');
    confirm.className = 'primary-button';
    confirm.type = 'button';
    confirm.textContent = '문 해제하기';

    const renderChoiceSection = (title: string, choices: readonly string[], apply: (value: string) => void): HTMLDivElement => {
      const block = document.createElement('div');
      block.className = 'shape-grid';

      const label = document.createElement('div');
      label.className = 'shape-target';
      label.textContent = title;
      block.append(label);

      choices.forEach((value) => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.type = 'button';
        button.textContent = value;
        button.addEventListener('click', () => {
          apply(value);
          feedback.textContent = `${title} 선택: ${value}`;
        });
        block.append(button);
      });

      return block;
    };

    sections.append(
      renderChoiceSection('색', FINAL_DOOR_COLOR_CHOICES.map((color) => COLOR_LABELS[color]), (value) => {
        const found = FINAL_DOOR_COLOR_CHOICES.find((color) => COLOR_LABELS[color] === value) ?? null;
        selections.color = found;
      }),
      renderChoiceSection('도형', FINAL_DOOR_SHAPE_CHOICES.map((shape) => SHAPE_LABELS[shape]), (value) => {
        const found = FINAL_DOOR_SHAPE_CHOICES.find((shape) => SHAPE_LABELS[shape] === value) ?? null;
        selections.shape = found;
      }),
      renderChoiceSection('음', FINAL_DOOR_NOTE_CHOICES.map((note) => RHYTHM_LABELS[note]), (value) => {
        const found = FINAL_DOOR_NOTE_CHOICES.find((note) => RHYTHM_LABELS[note] === value) ?? null;
        selections.note = found;
      }),
    );

    confirm.addEventListener('click', () => {
      const doorAnswer = this.stageFinalDoorAnswer;
      if (
        selections.color === doorAnswer.color &&
        selections.shape === doorAnswer.shape &&
        selections.note === doorAnswer.note
      ) {
        onSolved();
        this.renderSolvedState('세 단서를 다시 맞춰 무지개 문 잠금이 풀렸다.');
        return;
      }

      feedback.textContent = '조합이 틀렸어. 앞 교실과 연구 구역의 단서를 다시 떠올려 보자.';
    });

    wrapper.append(sections, feedback, confirm);
    this.modalBody.replaceChildren(wrapper);
  }

  openInfoCard(title: string, body: string): void {
    this.clearTimers();
    this.modalVisible = true;
    this.modalBackdrop.classList.remove('is-hidden');
    this.modalTitle.textContent = title;
    this.modalClose.hidden = false;
    this.collapseSecondaryPanelsForModal();
    this.setPrompt(null);

    const wrapper = document.createElement('div');
    wrapper.className = 'modal-body';

    const info = document.createElement('div');
    info.className = 'hint-box';
    info.textContent = body;

    const closeButton = document.createElement('button');
    closeButton.className = 'primary-button';
    closeButton.type = 'button';
    closeButton.textContent = '돌아가기';
    closeButton.addEventListener('click', () => this.closeModal());

    wrapper.append(info, closeButton);
    this.modalBody.replaceChildren(wrapper);
  }

  closeModal(): void {
    this.clearTimers();
    this.modalVisible = false;
    this.modalBackdrop.classList.add('is-hidden');
    this.modalBody.replaceChildren();
    this.restoreSecondaryPanelsAfterModal();
  }

  private bindEvents(): void {
    this.trackSecondaryPanel(this.trackerPanel, 'checklist');
    this.trackSecondaryPanel(this.minimapPanel, 'minimap');
    this.trackSecondaryPanel(this.abilityPanel, 'ability');

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

    this.nextStageButton.addEventListener('click', () => {
      this.hideClear();
      this.handlers.onNextStage?.();
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

    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.modalVisible || this.clearVisible || this.joystickPointerId !== null) {
        return;
      }

      this.lookPointerId = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.lastLookPoint = { x: event.clientX, y: event.clientY };
    });

    this.canvas.addEventListener('pointermove', (event) => {
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

    this.canvas.addEventListener('pointerup', releaseLook);
    this.canvas.addEventListener('pointercancel', releaseLook);

    const queueJump = (event?: Event): void => {
      event?.preventDefault();
      this.queueJump();
    };

    window.addEventListener('keydown', this.windowKeydownHandler);
    this.jumpButton.addEventListener('touchstart', queueJump, { passive: false });
    this.jumpButton.addEventListener('pointerdown', queueJump);
    this.jumpButton.addEventListener('click', queueJump);
  }

  private trackSecondaryPanel(panel: HTMLDetailsElement, key: SecondaryPanelKey): void {
    panel.addEventListener('toggle', () => {
      if (this.syncingSecondaryPanels) {
        return;
      }

      if (panel.open) {
        this.setActiveSecondaryPanel(key);
        return;
      }

      if (this.activeSecondaryPanel === key) {
        this.activeSecondaryPanel = null;
      }

      this.syncSecondaryPanelLabels();
    });
  }

  private setActiveSecondaryPanel(key: SecondaryPanelKey | null): void {
    this.syncingSecondaryPanels = true;
    this.secondaryPanels.forEach((panel) => {
      panel.element.open = panel.key === key;
    });
    this.syncingSecondaryPanels = false;
    this.activeSecondaryPanel = key;
    this.syncSecondaryPanelLabels();
  }

  private collapseSecondaryPanelsForModal(): void {
    if (this.secondaryPanelBeforeModal === null) {
      this.secondaryPanelBeforeModal = this.activeSecondaryPanel;
    }

    this.setActiveSecondaryPanel(null);
  }

  private restoreSecondaryPanelsAfterModal(): void {
    if (this.secondaryPanelBeforeModal !== null) {
      const panelToRestore = this.secondaryPanelBeforeModal;
      this.secondaryPanelBeforeModal = null;
      this.setActiveSecondaryPanel(panelToRestore);
      return;
    }

    this.syncSecondaryPanelLabels();
  }

  private syncSecondaryPanelLabels(): void {
    this.secondaryPanels.forEach((panel) => {
      panel.summary.textContent = `${panel.label}${panel.element.open ? ' 접기' : ' 펼치기'}`;
    });
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const rect = this.joystick.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const deadZone = radius * 0.14;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance < deadZone) {
      this.moveVector = { x: 0, y: 0 };
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
      return;
    }

    if (distance > radius) {
      const scale = radius / distance;
      dx *= scale;
      dy *= scale;
    }

    const remapped = (Math.min(distance, radius) - deadZone) / (radius - deadZone);
    const angle = Math.atan2(dy, dx);

    this.moveVector = {
      x: Number((Math.cos(angle) * remapped).toFixed(3)),
      y: Number((Math.sin(angle) * remapped).toFixed(3)),
    };

    this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  private renderColorPuzzle(onSolved: () => void): void {
    const definition = this.stagePuzzleDefs.colors;
    const seq = this.stageColorSequence;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const preview = document.createElement('div');
    preview.className = 'sequence-preview';

    const previewSlots = seq.map(() => {
      const slot = document.createElement('div');
      slot.className = 'sequence-slot';
      preview.append(slot);
      return slot;
    });

    const buttonGrid = document.createElement('div');
    buttonGrid.className = 'color-grid';
    let progress = 0;
    const feedback = this.createFeedback(`${seq.length}개의 버튼을 차례대로 눌러 보자.`);

    // Deduplicate button colors
    const uniqueColors = [...new Set(seq)];

    const updatePreview = (): void => {
      previewSlots.forEach((slot, index) => {
        const color = seq[index];
        const isFilled = index < progress;
        slot.classList.toggle('is-filled', isFilled);
        slot.textContent = isFilled ? COLOR_LABELS[color] : '?';
        slot.style.background = isFilled ? COLOR_HEX[color] : '';
      });
    };

    uniqueColors.forEach((color) => {
      const c = color;
      const button = document.createElement('button');
      button.className = 'puzzle-button';
      button.type = 'button';
      button.dataset.color = color;
      button.textContent = COLOR_LABELS[c];
      button.addEventListener('click', () => {
        if (seq[progress] === color) {
          progress += 1;
          feedback.textContent = `${COLOR_LABELS[c]} 좋아!`;
          updatePreview();
          if (progress === seq.length) {
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
    const definition = this.stagePuzzleDefs.shapes;
    const order = this.stageShapeOrder as readonly ShapeButton[];
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const slots = document.createElement('div');
    slots.className = 'shape-grid';
    const currentShapes: ShapeButton[] = order.map((_, i) => (['triangle', 'square', 'circle', 'triangle', 'diamond'] as ShapeButton[])[i % 5]);
    const feedback = this.createFeedback('칸을 눌러서 원하는 도형으로 바꿔 보자.');

    const shapeSequence: ShapeButton[] = ['circle', 'triangle', 'square', 'diamond', 'star'];
    const cycleShape = (shape: ShapeButton): ShapeButton => {
      const index = shapeSequence.indexOf(shape);
      return shapeSequence[(index + 1) % shapeSequence.length];
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

        if (currentShapes.every((current, currentIndex) => current === order[currentIndex])) {
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
    wrapper.append(slots, feedback);
    this.modalBody.replaceChildren(wrapper);
  }

  private renderCountingPuzzle(onSolved: () => void): void {
    const definition = this.stagePuzzleDefs.count;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const note = document.createElement('div');
    note.className = 'puzzle-note';
    note.textContent = '남쪽 긴 책상 위 줄무늬 연필만 세자. 짧은 막대나 다른 소품은 제외다.';

    const choices = document.createElement('div');
    choices.className = 'choice-grid';
    const feedback = this.createFeedback('숫자를 하나 골라 보자.');

    const countOpts = this.stageCountingOptions;
    const countAns = this.stageCountingAnswer;
    countOpts.forEach((value) => {
      const button = document.createElement('button');
      button.className = 'choice-button';
      button.type = 'button';
      button.textContent = `${value}`;
      button.addEventListener('click', () => {
        if (value === countAns) {
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
    const definition = this.stagePuzzleDefs.memory;
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

      const memSeq = this.stageMemorySequence;
      let delay = 450;
      memSeq.forEach((color) => {
        const button = buttonMap.get(color);
        if (!button) {
          return;
        }

        const flashStart = window.setTimeout(() => {
          button.classList.add('is-flashing');
        }, delay);
        const flashEnd = window.setTimeout(() => {
          button.classList.remove('is-flashing');
        }, delay + 280);
        this.activeTimers.push(flashStart, flashEnd);
        delay += 480;
      });

      const finish = window.setTimeout(() => {
        isPlayback = false;
        status.textContent = '이제 같은 순서로 눌러 보자.';
        feedback.textContent = '깜빡인 색 순서를 정확히 따라 해 보자.';
        buttonMap.forEach((button) => {
          button.disabled = false;
        });
      }, delay + 120);
      this.activeTimers.push(finish);
    };

    const memSeq = this.stageMemorySequence;
    const uniqueMemColors = [...new Set(memSeq)];
    uniqueMemColors.forEach((color) => {
      const button = document.createElement('button');
      button.className = 'memory-button';
      button.type = 'button';
      button.dataset.color = color;
      button.textContent = MEMORY_LABELS[color];
      button.style.background = MEMORY_HEX[color];
      button.addEventListener('click', () => {
        if (isPlayback) {
          return;
        }

        if (memSeq[progress] === color) {
          progress += 1;
          feedback.textContent = `${MEMORY_LABELS[color]} 좋아!`;
          if (progress === memSeq.length) {
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

  private renderRhythmPuzzle(onSolved: () => void): void {
    const definition = this.stagePuzzleDefs.rhythm;
    const rhythmSeq = this.stageRhythmSequence;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const preview = document.createElement('div');
    preview.className = 'sequence-preview';

    const previewSlots = rhythmSeq.map(() => {
      const slot = document.createElement('div');
      slot.className = 'sequence-slot';
      preview.append(slot);
      return slot;
    });

    const buttonGrid = document.createElement('div');
    buttonGrid.className = 'choice-grid';
    let progress = 0;
    const feedback = this.createFeedback('악보 순서를 떠올리며 음 패드를 눌러 보자.');

    const updatePreview = (): void => {
      previewSlots.forEach((slot, index) => {
        slot.textContent = index < progress ? RHYTHM_LABELS[rhythmSeq[index]] : '?';
        slot.classList.toggle('is-filled', index < progress);
      });
    };

    (['do', 'mi', 'sol', 'la', 'ti'] as const).forEach((note) => {
      const button = document.createElement('button');
      button.className = 'choice-button';
      button.type = 'button';
      button.textContent = RHYTHM_LABELS[note];
      button.addEventListener('click', () => {
        if (rhythmSeq[progress] === note) {
          progress += 1;
          feedback.textContent = `${RHYTHM_LABELS[note]} 좋아!`;
          updatePreview();
          if (progress === rhythmSeq.length) {
            onSolved();
            this.renderSolvedState(definition.success);
          }
          return;
        }

        progress = 0;
        updatePreview();
        feedback.textContent = '박자가 틀렸어. 다시 첫 음부터 맞춰 보자.';
      });
      buttonGrid.append(button);
    });

    updatePreview();
    wrapper.append(preview, buttonGrid, feedback);
    this.modalBody.replaceChildren(wrapper);
  }

  private renderSwitchPuzzle(onSolved: () => void): void {
    const definition = this.stagePuzzleDefs.switches;
    const switchTarget = this.stageSwitchTarget;
    const wrapper = this.createPuzzleWrapper(definition.subtitle, definition.hint);
    const toggles = document.createElement('div');
    toggles.className = 'choice-grid';
    const feedback = this.createFeedback('목표 패턴과 같은 켜짐 상태를 만들자.');
    const state = switchTarget.map((_, index) => index % 2 === 0 ? false : true);

    const renderButtons = (): void => {
      buttons.forEach((button, index) => {
        const isOn = state[index];
        button.textContent = isOn ? `스위치 ${index + 1} ON` : `스위치 ${index + 1} OFF`;
        button.classList.toggle('is-on', isOn);
      });
    };

    const buttons = state.map((_, index) => {
      const button = document.createElement('button');
      button.className = 'choice-button';
      button.type = 'button';
      const linked = this.stageSwitchLinked;
      button.addEventListener('click', () => {
        state[index] = !state[index];
        if (linked && index > 0) {
          state[index - 1] = !state[index - 1];
        }
        if (linked && index < state.length - 1) {
          state[index + 1] = !state[index + 1];
        }
        renderButtons();

        if (state.every((value, stateIndex) => value === switchTarget[stateIndex])) {
          onSolved();
          this.renderSolvedState(definition.success);
        } else {
          feedback.textContent = linked
            ? '양옆 스위치도 같이 바뀌어. 잘 생각해서 눌러 보자.'
            : '아직 패턴이 맞지 않아. 목표와 비교해 보자.';
        }
      });
      toggles.append(button);
      return button;
    });

    renderButtons();
    wrapper.append(toggles, feedback);
    this.modalBody.replaceChildren(wrapper);
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
    hintNode.hidden = true;

    const hintToggle = document.createElement('button');
    hintToggle.className = 'secondary-button';
    hintToggle.type = 'button';
    hintToggle.textContent = '힌트 보기';
    hintToggle.addEventListener('click', () => {
      hintNode.hidden = !hintNode.hidden;
      hintToggle.textContent = hintNode.hidden ? '힌트 보기' : '힌트 숨기기';
    });

    wrapper.append(subtitleNode, hintToggle, hintNode);
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
    followUp.textContent = '별 조각이 인벤토리에 저장됐다. 다음 구역까지 계속 탐험하자.';

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
