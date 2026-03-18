import * as pc from 'playcanvas';
import {
  PUZZLE_DEFINITIONS, PUZZLE_IDS, STAGE_TITLE, STAGE_SUBTITLE,
  STAGE_2_TITLE, STAGE_2_SUBTITLE, STAGE_2_DEFINITIONS,
  type PuzzleDefinition,
} from './puzzles';
import { ProgressStore, countSolvedPuzzles } from './ProgressStore';
import type { GameProgress, ProgressState, PromptState, PuzzleId } from './types';
import { OverlayUI } from './ui';

type PuzzleStation = {
  kind: 'puzzle';
  id: PuzzleId;
  entity: pc.Entity;
  prompt: PromptState;
  orb: pc.Entity;
  orbMaterial: pc.StandardMaterial;
  highlightMaterial: pc.StandardMaterial;
  baseColor: pc.Color;
  solvedColor: pc.Color;
};

type DoorStation = {
  kind: 'door';
  entity: pc.Entity;
  prompt: PromptState;
};

type ClueStation = {
  kind: 'clue';
  entity: pc.Entity;
  prompt: PromptState;
  title: string;
  body: string;
};

type Interactable = PuzzleStation | DoorStation | ClueStation;

type Obstacle = {
  x: number;
  z: number;
  radius: number;
};

const PLAYER_RADIUS = 0.7;
const PLAYER_MOVE_SPEED = 8.5;
const PLAYER_AIR_SPEED = 7.0;
const PLAYER_ACCELERATION = 16;
const PLAYER_DECELERATION = 18;
const PLAYER_AIR_ACCELERATION = 10;
const CAMERA_ROTATION_SENSITIVITY = 0.11;
const CAMERA_YAW_LIMIT = 55;
const CAMERA_PITCH_LIMIT_UP = 35;
const CAMERA_PITCH_LIMIT_DOWN = -22;
const LANDING_BOUNCE_DECAY = 5.2;

const SOLVED_HIGHLIGHT_COLOR = new pc.Color(1, 0.84, 0.36);
const SOLVED_HIGHLIGHT_EMISSIVE = new pc.Color(0.26, 0.22, 0.02);
const UNSOLVED_HIGHLIGHT_EMISSIVE = new pc.Color(0.03, 0.03, 0.05);
const SOLVED_ORB_DIFFUSE = new pc.Color(1, 0.82, 0.33);
const SOLVED_ORB_EMISSIVE = new pc.Color(0.8, 0.62, 0.18);
const UNSOLVED_ORB_DIFFUSE = new pc.Color(0.27, 0.31, 0.39);
const UNSOLVED_ORB_EMISSIVE = new pc.Color(0.08, 0.1, 0.12);
const SOLVED_SLOT_DIFFUSE = new pc.Color(1, 0.82, 0.33);
const SOLVED_SLOT_EMISSIVE = new pc.Color(0.88, 0.66, 0.16);
const UNSOLVED_SLOT_DIFFUSE = new pc.Color(0.23, 0.26, 0.35);
const UNSOLVED_SLOT_EMISSIVE = new pc.Color(0.03, 0.03, 0.04);
const ROOM_HALF_WIDTH = 20;
const ROOM_HALF_DEPTH = 28;
const PLAYER_START_Z = 16.5;
const FINAL_DOOR_Z = -26.1;

export class JennyworldGame {
  private readonly app: pc.Application;
  private readonly ui: OverlayUI;
  private readonly progressStore = new ProgressStore();
  private gameProgress: GameProgress;
  private get progress(): ProgressState {
    return this.currentStage === 1 ? this.gameProgress.stage1 : this.gameProgress.stage2;
  }
  private set progress(value: ProgressState) {
    if (this.currentStage === 1) {
      this.gameProgress.stage1 = value;
    } else {
      this.gameProgress.stage2 = value;
    }
  }
  private readonly resizeHandler: () => void;
  private readonly playerRoot: pc.Entity;
  private readonly camera: pc.Entity;
  private readonly doorRoot: pc.Entity;
  private readonly researchGateRoot: pc.Entity;
  private readonly interactables: Interactable[] = [];
  private readonly floatingEntities: Array<{ entity: pc.Entity; baseY: number }> = [];
  private readonly puzzleStations = new Map<PuzzleId, PuzzleStation>();
  private readonly obstacleMap: Obstacle[] = [];
  private readonly researchGateObstacle: Obstacle = { x: 0, z: -6.4, radius: 2.25 };
  private readonly doorSlots: pc.Entity[] = [];
  private readonly playerVelocity = new pc.Vec3();
  private readonly _inputVec = new pc.Vec3();
  private readonly _forwardVec = new pc.Vec3();
  private readonly _rightVec = new pc.Vec3();
  private readonly _desiredDir = new pc.Vec3();
  private readonly _candidatePos = new pc.Vec3();
  private readonly _camRight = new pc.Vec3();
  private readonly _camLead = new pc.Vec3();
  private readonly _camDesired = new pc.Vec3();
  private readonly _camNext = new pc.Vec3();
  private readonly _minimapMarkers = PUZZLE_IDS.map(() => ({ x: 0, y: 0, solved: false }));
  private walkCycle = 0;
  private playerHeight = 0;
  private verticalVelocity = 0;
  private jumpKeyWasDown = false;
  private wasAirborne = false;
  private landingBounce = 0;
  private nearestInteractable: Interactable | null = null;
  private isResearchGateOpening = false;
  private researchGateOpenAmount = 0;
  private isDoorOpening = false;
  private doorOpenAmount = 0;
  private clearShown = false;
  private timeElapsed = 0;
  private cameraYaw = 0;
  private cameraPitch = 6;
  private lastZoneLabel: string | null = null;
  private pendingJump = false;
  private jumpCharge = 0;
  private cameraDragIdle = 0;
  private hintTimer = 0;
  private currentStage: 1 | 2 = 1;
  private isTransitioning = false;
  private _actionKeyWasDown = false;

  constructor(canvas: HTMLCanvasElement, ui: OverlayUI) {
    this.ui = ui;
    this.gameProgress = this.progressStore.load();
    this.currentStage = this.gameProgress.stage;
    this.clearShown = this.progress.cleared;

    this.app = new pc.Application(canvas, {
      keyboard: new pc.Keyboard(window),
      mouse: new pc.Mouse(canvas),
      touch: new pc.TouchDevice(canvas),
      graphicsDeviceOptions: {
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      },
    });

    this.app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight = new pc.Color(0.74, 0.78, 0.88);
    this.app.start();

    this.playerRoot = new pc.Entity('player-root');
    this.camera = new pc.Entity('camera');
    this.doorRoot = new pc.Entity('door-root');
    this.researchGateRoot = new pc.Entity('research-gate-root');

    this.resizeHandler = () => {
      this.app.resizeCanvas();
    };
    window.addEventListener('resize', this.resizeHandler);

    if (this.currentStage === 2) {
      this.ui.setStage(2);
      this.createLights();
      this.createCamera();
      this.buildRoom2();
      this.restoreStateFromProgress();
      this.refreshChecklist();
      this.updateHud();
      this.updateObjective();
      this.ui.setProgress(countSolvedPuzzles(this.progress), PUZZLE_IDS.length);
      this.ui.updateBrandTitle(STAGE_2_TITLE, STAGE_2_SUBTITLE);
      this.ui.updateClearText(
        `${STAGE_2_TITLE} 돌파 성공`,
        '별빛 정원의 모든 퍼즐을 풀었다. 축하해!',
        '교실부터 다시 시작',
      );
      this.ui.showToast('별빛 정원을 계속 탐험하자!');
    } else {
      this.buildScene();
      this.restoreStateFromProgress();
      this.refreshChecklist();
      this.updateHud();
      this.updateObjective();
      this.ui.setProgress(countSolvedPuzzles(this.progress), PUZZLE_IDS.length);
      this.ui.showToast('앞쪽 교실에서 단서를 모으고, 뒤쪽 연구 구역까지 돌파해 보자.');
    }

    this.app.on('update', (dt: number) => {
      this.update(dt);
    });
  }

  getCurrentStage(): 1 | 2 {
    return this.currentStage;
  }

  private clearScene(): void {
    const keep = new Set<pc.Entity>([this.camera, this.playerRoot, this.doorRoot, this.researchGateRoot]);
    const entitiesToRemove: pc.Entity[] = [];
    this.app.root.children.forEach((child) => {
      if (!keep.has(child as pc.Entity) && child.name !== 'sun' && child.name !== 'fill') {
        entitiesToRemove.push(child as pc.Entity);
      }
    });
    entitiesToRemove.forEach((entity) => entity.destroy());
    this.interactables.length = 0;
    this.floatingEntities.length = 0;
    this.obstacleMap.length = 0;
    this.puzzleStations.clear();
    this.doorSlots.length = 0;

    // Clear children of reused root entities without destroying the roots
    [this.playerRoot, this.doorRoot, this.researchGateRoot].forEach((root) => {
      while (root.children.length > 0) {
        (root.children[0] as pc.Entity).destroy();
      }
    });
  }

  focus(): void {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      return;
    }

    const canvas = this.app.graphicsDevice.canvas as HTMLCanvasElement;
    canvas.focus?.();
    this.ui.focusCanvas();
  }

  destroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.app.destroy();
  }

  advanceTime(ms: number): void {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    const stepDt = ms / 1000 / steps;

    for (let index = 0; index < steps; index += 1) {
      this.update(stepDt);
    }

    this.app.render();
  }

  renderGameToText(): string {
    const playerPosition = this.playerRoot.getPosition();
    const zone = this.currentStage === 1
      ? (playerPosition.z > 6 ? 'front-classroom' : playerPosition.z > -8 ? 'middle-corridor' : 'research-wing')
      : (playerPosition.z > 6 ? 'garden-front' : playerPosition.z > -8 ? 'garden-center' : 'garden-inner');
    const nearest =
      this.nearestInteractable?.kind === 'puzzle'
        ? { kind: 'puzzle', id: this.nearestInteractable.id, title: this.nearestInteractable.prompt.title }
        : this.nearestInteractable
          ? { kind: this.nearestInteractable.kind, title: this.nearestInteractable.prompt.title }
          : null;

    return JSON.stringify({
      stage: this.currentStage === 1 ? STAGE_TITLE : STAGE_2_TITLE,
      progress: this.progress,
      solvedCount: countSolvedPuzzles(this.progress),
      zone,
      player: {
        x: Number(playerPosition.x.toFixed(2)),
        y: Number(playerPosition.y.toFixed(2)),
        z: Number(playerPosition.z.toFixed(2)),
        speed: Number(Math.hypot(this.playerVelocity.x, this.playerVelocity.z).toFixed(2)),
      },
      camera: {
        yaw: Number(this.cameraYaw.toFixed(2)),
      },
      gate: {
        openAmount: Number(this.researchGateOpenAmount.toFixed(2)),
      },
      nearest,
      doorOpenAmount: Number(this.doorOpenAmount.toFixed(2)),
      blockingUI: this.ui.isBlockingGame(),
    });
  }

  handleAction(): void {
    if (this.isTransitioning) {
      return;
    }
    const target = this.nearestInteractable;
    if (!target) {
      return;
    }

    if (target.kind === 'door') {
      const missing = PUZZLE_IDS.length - countSolvedPuzzles(this.progress);
      if (missing > 0) {
        const defs = this.currentStage === 1 ? PUZZLE_DEFINITIONS : STAGE_2_DEFINITIONS;
        const unsolved = PUZZLE_IDS.filter((puzzleId) => !this.progress[puzzleId])
          .slice(0, 2)
          .map((puzzleId) => defs[puzzleId].title)
          .join(', ');
        this.ui.showToast(`아직 ${unsolved}${missing > 2 ? ' 외 퍼즐' : ''}이 남아 있어.`);
        return;
      }

      if (!this.isDoorOpening && !this.progress.cleared) {
        this.ui.openFinalDoorExam(() => {
          this.isDoorOpening = true;
          this.ui.showToast('최종 시험을 통과했다. 무지개 문이 열린다!');
        });
      }
      return;
    }

    if (target.kind === 'clue') {
      this.ui.openInfoCard(target.title, target.body);
      return;
    }

    if (this.progress[target.id]) {
      return;
    }

    this.ui.openPuzzle(target.id, () => {
      this.solvePuzzle(target.id);
    });
  }

  async resetStage(): Promise<void> {
    if (this.isTransitioning) {
      return;
    }
    this.isTransitioning = true;
    try {
      await this.ui.showTransition('교실로 돌아가는 중...');

      this.clearScene();

      this.gameProgress = this.progressStore.reset();
      this.currentStage = 1;
      this.clearShown = false;
      this.isResearchGateOpening = false;
      this.researchGateOpenAmount = 0;
      this.isDoorOpening = false;
      this.doorOpenAmount = 0;
      this.timeElapsed = 0;
      this.playerHeight = 0;
      this.verticalVelocity = 0;
      this.jumpKeyWasDown = false;
      this.wasAirborne = false;
      this.landingBounce = 0;
      this.playerVelocity.set(0, 0, 0);
      this.cameraYaw = 0;
      this.cameraPitch = 6;
      this.lastZoneLabel = null;
      this.pendingJump = false;
      this.jumpCharge = 0;
      this.hintTimer = 0;
      this.nearestInteractable = null;
      this._actionKeyWasDown = false;
      this.ui.setStage(1);

      // Restore Room 1 lighting
      const sun = this.app.root.findByName('sun') as pc.Entity | null;
      if (sun?.light) {
        sun.light.color = new pc.Color(1, 0.96, 0.86);
        sun.light.intensity = 1.8;
      }
      const fill = this.app.root.findByName('fill') as pc.Entity | null;
      if (fill?.light) {
        fill.light.color = new pc.Color(0.72, 0.85, 1);
        fill.light.intensity = 0.9;
      }
      this.app.scene.ambientLight = new pc.Color(0.74, 0.78, 0.88);
      const cameraComponent = this.camera.camera;
      if (cameraComponent) {
        cameraComponent.clearColor = new pc.Color(0.86, 0.96, 1);
      }

      this.buildScene();
      this.restoreStateFromProgress();
      this.refreshChecklist();
      this.updateHud();
      this.updateObjective();
      this.ui.setPrompt(null);
      this.ui.setProgress(0, PUZZLE_IDS.length);
      this.ui.updateBrandTitle(STAGE_TITLE, STAGE_SUBTITLE);
      this.ui.updateClearText(
        `${STAGE_TITLE} 돌파 성공`,
        '별 조각 여섯 개를 모아 돌파 성공! 다음 방이 기다리고 있다.',
        '별빛 정원으로 이동',
      );
      this.camera.setPosition(0, 7.8, PLAYER_START_Z + 12.5);

      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      this.ui.hideTransition();
      this.ui.showToast('탐험 교실을 처음부터 다시 시작했다.');
    } finally {
      this.isTransitioning = false;
    }
  }

  private buildScene(): void {
    this.createLights();
    this.createRoom();
    this.createResearchGate();
    this.createDoor();
    this.createPuzzleStations();
    this.createDecor();
    this.createClueStations();
    this.createPlayer();
    this.createCamera();
  }

  private createClueStations(): void {
    const clues: Array<{ position: pc.Vec3; title: string; body: string; prompt: PromptState }> = [
      {
        position: new pc.Vec3(-6.6, 0.3, 12.4),
        title: '바닥 타일 단서',
        body: '바닥 타일에 다섯 가지 색이 순서대로 새겨져 있다: 빨강, 파랑, 노랑, 초록, 핑크.',
        prompt: { title: '바닥 타일', detail: '책상 아래에 무언가가 보인다.', actionLabel: '단서 보기' },
      },
      {
        position: new pc.Vec3(18.2, 1.5, -11.8),
        title: '책장 뒤 메모',
        body: '꼭짓점이 없는 것부터 차례로: 원, 세모, 네모, 마름모. 도형 자물쇠의 열쇠다.',
        prompt: { title: '숨겨진 메모', detail: '책장 뒤에 뭔가 끼워져 있다.', actionLabel: '단서 보기' },
      },
      {
        position: new pc.Vec3(0, 5.0, -6.4),
        title: '천장 무늬 단서',
        body: '천장 들보에 불빛 패턴이 그려져 있다: 켜, 꺼, 켜, 켜, 꺼.',
        prompt: { title: '천장 무늬', detail: '위를 올려다보면 무늬가 보인다.', actionLabel: '단서 보기' },
      },
      {
        position: new pc.Vec3(0, 0.3, -13.8),
        title: '책상 밑 악보',
        body: '책상 밑에 떨어진 악보 조각: 도, 미, 솔, 라, 솔, 미. 멜로디 패널의 순서다.',
        prompt: { title: '악보 조각', detail: '책상 밑에 종이가 떨어져 있다.', actionLabel: '단서 보기' },
      },
    ];

    const glowMaterial = this.makeMaterial([1, 0.9, 0.4], [1, 0.85, 0.3], 0.8);
    glowMaterial.emissiveIntensity = 2.5;
    glowMaterial.opacity = 0.6;
    glowMaterial.blendType = pc.BLEND_ADDITIVE;
    glowMaterial.depthWrite = false;
    glowMaterial.update();

    const clueMarkerMaterial = this.makeMaterial([0.88, 0.82, 0.62], [0.12, 0.1, 0.05]);
    const clueRingMaterial = this.makeMaterial([1, 0.92, 0.5], [0.3, 0.25, 0.08]);
    clueRingMaterial.emissiveIntensity = 1.4;
    clueRingMaterial.update();

    clues.forEach((clue, index) => {
      const anchor = new pc.Entity(`clue-anchor-${index}`);
      anchor.setPosition(clue.position);
      this.app.root.addChild(anchor);

      anchor.addChild(this.makePrimitive('cylinder', clueMarkerMaterial, new pc.Vec3(0, 0.02, 0), new pc.Vec3(0.7, 0.04, 0.7), `clue-disc-${index}`));
      anchor.addChild(this.makePrimitive('cylinder', clueRingMaterial, new pc.Vec3(0, 0.05, 0), new pc.Vec3(0.85, 0.03, 0.85), `clue-ring-${index}`));

      const glow = this.makePrimitive('sphere', glowMaterial, new pc.Vec3(0, 0.5, 0), new pc.Vec3(0.25, 0.25, 0.25), `clue-glow-${index}`, false);
      anchor.addChild(glow);
      this.floatingEntities.push({ entity: glow, baseY: 0.5 });

      this.interactables.push({
        kind: 'clue',
        entity: anchor,
        prompt: clue.prompt,
        title: clue.title,
        body: clue.body,
      });
    });
  }

  private createResearchGate(): void {
    const frameMaterial = this.makeMaterial([0.36, 0.39, 0.52], [0.06, 0.08, 0.12]);
    const panelMaterial = this.makeMaterial([0.84, 0.96, 1], [0.18, 0.2, 0.24]);
    panelMaterial.emissiveIntensity = 0.8;
    panelMaterial.update();

    this.researchGateRoot.setLocalPosition(0, 0, -6.4);
    this.app.root.addChild(this.researchGateRoot);
    this.researchGateRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(-2.2, 2.4, 0), new pc.Vec3(0.3, 4.8, 0.5), 'research-gate-left'));
    this.researchGateRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(2.2, 2.4, 0), new pc.Vec3(0.3, 4.8, 0.5), 'research-gate-right'));
    this.researchGateRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(0, 4.85, 0), new pc.Vec3(4.7, 0.3, 0.5), 'research-gate-top'));

    [-1.45, 0, 1.45].forEach((x, index) => {
      this.researchGateRoot.addChild(
        this.makePrimitive('box', panelMaterial, new pc.Vec3(x, 2.3, 0), new pc.Vec3(1.2, 4.4, 0.24), `research-gate-panel-${index}`),
      );
    });
    this.obstacleMap.push(this.researchGateObstacle);
  }

  private createLights(): void {
    let sun = this.app.root.findByName('sun') as pc.Entity | null;
    if (!sun) {
      sun = new pc.Entity('sun');
      sun.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 0.96, 0.86),
        intensity: 1.8,
        castShadows: true,
        shadowDistance: 42,
        shadowBias: 0.25,
        normalOffsetBias: 0.04,
        shadowResolution: 2048,
      });
      sun.setEulerAngles(45, 45, 0);
      this.app.root.addChild(sun);
    } else if (sun.light) {
      sun.light.color = new pc.Color(1, 0.96, 0.86);
      sun.light.intensity = 1.8;
    }

    let fill = this.app.root.findByName('fill') as pc.Entity | null;
    if (!fill) {
      fill = new pc.Entity('fill');
      fill.addComponent('light', {
        type: 'omni',
        color: new pc.Color(0.72, 0.85, 1),
        intensity: 0.9,
        range: 24,
      });
      fill.setPosition(0, 8, 2);
      this.app.root.addChild(fill);
    } else if (fill.light) {
      fill.light.color = new pc.Color(0.72, 0.85, 1);
      fill.light.intensity = 0.9;
    }
  }

  private createRoom(): void {
    const floorMaterial = this.makeMaterial([0.98, 0.92, 0.72], [0.13, 0.1, 0.04]);
    const wallMaterial = this.makeMaterial([0.88, 0.95, 1], [0.02, 0.04, 0.09]);
    const trimMaterial = this.makeMaterial([1, 0.8, 0.43], [0.12, 0.08, 0]);
    const cloudMaterial = this.makeMaterial([1, 1, 1], [0.15, 0.15, 0.15]);

    this.app.root.addChild(this.makePrimitive('box', floorMaterial, new pc.Vec3(0, -0.5, 0), new pc.Vec3(ROOM_HALF_WIDTH * 2, 1, ROOM_HALF_DEPTH * 2), 'floor'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(-ROOM_HALF_WIDTH - 0.5, 3, 0), new pc.Vec3(1, 6, ROOM_HALF_DEPTH * 2), 'wall-west'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(ROOM_HALF_WIDTH + 0.5, 3, 0), new pc.Vec3(1, 6, ROOM_HALF_DEPTH * 2), 'wall-east'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(0, 3, ROOM_HALF_DEPTH + 0.5), new pc.Vec3(ROOM_HALF_WIDTH * 2 + 1, 6, 1), 'wall-south'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(-9.5, 3, -ROOM_HALF_DEPTH - 0.5), new pc.Vec3(21, 6, 1), 'wall-north-left'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(9.5, 3, -ROOM_HALF_DEPTH - 0.5), new pc.Vec3(21, 6, 1), 'wall-north-right'));
    this.app.root.addChild(this.makePrimitive('box', trimMaterial, new pc.Vec3(0, 0.15, 0), new pc.Vec3(ROOM_HALF_WIDTH * 2, 0.3, ROOM_HALF_DEPTH * 2), 'trim-bottom'));
    this.app.root.addChild(this.makePrimitive('box', trimMaterial, new pc.Vec3(0, 5.2, FINAL_DOOR_Z), new pc.Vec3(8.4, 1.6, 1), 'door-beam'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(-7.8, 3, -6.4), new pc.Vec3(10.4, 6, 1), 'divider-west'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(7.8, 3, -6.4), new pc.Vec3(10.4, 6, 1), 'divider-east'));
    this.app.root.addChild(this.makePrimitive('box', trimMaterial, new pc.Vec3(0, 5.1, -6.4), new pc.Vec3(5.4, 1.1, 1), 'divider-beam'));
    [-13.4, -9.6, -6.1, 6.1, 9.6, 13.4].forEach((x, index) => {
      this.obstacleMap.push({ x, z: -6.4, radius: index === 2 || index === 3 ? 0.8 : 1.1 });
    });

    const rugs = [
      { position: new pc.Vec3(0, -0.36, 13.5), scale: new pc.Vec3(18, 0.05, 10), color: [1, 0.95, 0.67] as [number, number, number] },
      { position: new pc.Vec3(-9.5, -0.34, -18), scale: new pc.Vec3(12, 0.05, 12), color: [0.88, 0.94, 1] as [number, number, number] },
      { position: new pc.Vec3(9.5, -0.34, -18), scale: new pc.Vec3(12, 0.05, 12), color: [1, 0.9, 0.96] as [number, number, number] },
    ];
    rugs.forEach((rug, index) => {
      this.app.root.addChild(
        this.makePrimitive('box', this.makeMaterial(rug.color, [0.06, 0.06, 0.06]), rug.position, rug.scale, `rug-${index}`),
      );
    });

    const clouds = [
      new pc.Vec3(-13.8, 4.7, 24.2),
      new pc.Vec3(0, 4.4, 24.4),
      new pc.Vec3(13.8, 4.7, 24.2),
    ];
    clouds.forEach((position, index) => {
      const cloud = this.makePrimitive('sphere', cloudMaterial, position, new pc.Vec3(1.8, 0.9, 0.45), `cloud-${index}`);
      this.app.root.addChild(cloud);
    });

    const ceilingMaterial = this.makeMaterial([0.94, 0.96, 1], [0.04, 0.04, 0.06]);
    this.app.root.addChild(this.makePrimitive('box', ceilingMaterial, new pc.Vec3(0, 6.1, 0), new pc.Vec3(ROOM_HALF_WIDTH * 2, 0.2, ROOM_HALF_DEPTH * 2), 'ceiling'));

    const windowFrameMaterial = this.makeMaterial([0.48, 0.42, 0.32], [0.06, 0.05, 0.03]);
    const windowGlassMaterial = this.makeMaterial([0.75, 0.88, 1], [0.08, 0.12, 0.18]);
    windowGlassMaterial.emissiveIntensity = 1.2;
    windowGlassMaterial.opacity = 0.6;
    windowGlassMaterial.blendType = pc.BLEND_NORMAL;
    windowGlassMaterial.update();
    [-10, 10].forEach((x, index) => {
      this.app.root.addChild(this.makePrimitive('box', windowFrameMaterial, new pc.Vec3(x, 3.6, 27.35), new pc.Vec3(3.6, 2.4, 0.12), `window-frame-${index}`));
      this.app.root.addChild(this.makePrimitive('box', windowGlassMaterial, new pc.Vec3(x, 3.6, 27.32), new pc.Vec3(3.0, 1.9, 0.06), `window-glass-${index}`));
    });
  }

  private createDoor(): void {
    this.doorRoot.setLocalPosition(0, 0, FINAL_DOOR_Z);
    this.app.root.addChild(this.doorRoot);

    const frameMaterial = this.makeMaterial([0.34, 0.37, 0.52], [0.06, 0.07, 0.1]);
    const colors: Array<[number, number, number]> = [
      [1, 0.47, 0.42],
      [1, 0.73, 0.33],
      [1, 0.91, 0.46],
      [0.43, 0.84, 0.99],
      [0.52, 0.95, 0.8],
    ];

    this.doorRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(-4.05, 2.55, 0), new pc.Vec3(0.35, 5.1, 0.6), 'door-frame-left'));
    this.doorRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(4.05, 2.55, 0), new pc.Vec3(0.35, 5.1, 0.6), 'door-frame-right'));
    this.doorRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(0, 5.1, 0), new pc.Vec3(8.5, 0.35, 0.6), 'door-frame-top'));

    colors.forEach((color, index) => {
      const panelMaterial = this.makeMaterial(color, [0.06, 0.06, 0.06]);
      const panel = this.makePrimitive(
        'box',
        panelMaterial,
        new pc.Vec3(-2.8 + index * 1.12, 2.52, 0),
        new pc.Vec3(1.04, 4.9, 0.38),
        `door-panel-${index}`,
      );
      this.doorRoot.addChild(panel);
    });

    PUZZLE_IDS.forEach((_, index) => {
      const slotMaterial = this.makeMaterial([0.23, 0.26, 0.35], [0.03, 0.03, 0.04]);
      const slot = this.makePrimitive(
        'sphere',
        slotMaterial,
        new pc.Vec3(-3 + index * 1.2, 6.15, 0.22),
        new pc.Vec3(0.38, 0.38, 0.22),
        `door-slot-${index}`,
      );
      this.doorSlots.push(slot);
      this.doorRoot.addChild(slot);
    });

    this.interactables.push({
      kind: 'door',
      entity: this.doorRoot,
      prompt: {
        title: '무지개 문',
        detail: '별 조각 여섯 개를 모두 모아야 탈출 문이 열린다.',
        actionLabel: '문 열기',
      },
    });
  }

  private createPuzzleStations(): void {
    const stationSpecs: Array<{ id: PuzzleId; position: pc.Vec3 }> = [
      { id: 'colors', position: new pc.Vec3(-14, 0, 15) },
      { id: 'shapes', position: new pc.Vec3(14, 0, 14) },
      { id: 'count', position: new pc.Vec3(0, 0, 2.4) },
      { id: 'memory', position: new pc.Vec3(-14, 0, -18) },
      { id: 'rhythm', position: new pc.Vec3(0, 0, -19.5) },
      { id: 'switches', position: new pc.Vec3(14, 0, -18) },
    ];

    stationSpecs.forEach(({ id, position }) => {
      const definition = PUZZLE_DEFINITIONS[id];
      const station = this.createPuzzleStation(id, definition, position);
      this.interactables.push(station);
      this.puzzleStations.set(id, station);
      this.obstacleMap.push({ x: position.x, z: position.z, radius: 1.55 });
    });
  }

  private createPuzzleStation(id: PuzzleId, definition: PuzzleDefinition, position: pc.Vec3): PuzzleStation {
    const root = new pc.Entity(`${id}-station`);
    root.setPosition(position);
    this.app.root.addChild(root);

    const baseColor = new pc.Color(...definition.pedestalColor);
    const solvedColor = new pc.Color(1, 0.84, 0.36);
    const baseMaterial = this.makeMaterial(definition.pedestalColor, [0.06, 0.06, 0.09]);
    const orbMaterial = this.makeMaterial([0.27, 0.31, 0.39], [0.08, 0.1, 0.12]);
    orbMaterial.emissiveIntensity = 1.6;
    orbMaterial.update();

    const pedestal = this.makePrimitive('box', baseMaterial, new pc.Vec3(0, 1.15, 0), new pc.Vec3(2.2, 2.3, 2.2), `${id}-pedestal`);
    const plate = this.makePrimitive('box', this.makeMaterial([1, 1, 1], [0.2, 0.2, 0.2]), new pc.Vec3(0, 2.45, 0), new pc.Vec3(1.95, 0.18, 1.95), `${id}-plate`);
    const orb = this.makePrimitive('sphere', orbMaterial, new pc.Vec3(0, 3.45, 0), new pc.Vec3(0.72, 0.72, 0.72), `${id}-orb`);
    root.addChild(pedestal);
    root.addChild(plate);
    root.addChild(orb);
    this.floatingEntities.push({ entity: orb, baseY: 3.45 });

    this.decorateStation(id, root);

    return {
      kind: 'puzzle',
      id,
      entity: root,
      prompt: {
        title: definition.title,
        detail: definition.prompt,
        actionLabel: '퍼즐 열기',
      },
      orb,
      orbMaterial,
      highlightMaterial: baseMaterial,
      baseColor,
      solvedColor,
    };
  }

  private decorateStation(id: PuzzleId, root: pc.Entity): void {
    const whiteMaterial = this.makeMaterial([1, 1, 1], [0.12, 0.12, 0.12]);
    const yellowMaterial = this.makeMaterial([1, 0.84, 0.37], [0.12, 0.1, 0]);
    const blueMaterial = this.makeMaterial([0.41, 0.74, 1], [0.03, 0.06, 0.12]);
    const pinkMaterial = this.makeMaterial([1, 0.66, 0.84], [0.12, 0.03, 0.08]);
    const greenMaterial = this.makeMaterial([0.41, 0.9, 0.64], [0.04, 0.1, 0.07]);
    const purpleMaterial = this.makeMaterial([0.72, 0.57, 1], [0.09, 0.04, 0.12]);

    if (id === 'colors') {
      root.addChild(this.makePrimitive('box', this.makeMaterial([1, 0.44, 0.41], [0.1, 0.03, 0.03]), new pc.Vec3(-0.72, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'red-cube'));
      root.addChild(this.makePrimitive('box', blueMaterial, new pc.Vec3(0, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'blue-cube'));
      root.addChild(this.makePrimitive('box', yellowMaterial, new pc.Vec3(0.72, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'yellow-cube'));
      root.addChild(this.makePrimitive('box', greenMaterial, new pc.Vec3(-0.36, 3.18, -0.48), new pc.Vec3(0.28, 0.28, 0.28), 'green-cube'));
      root.addChild(this.makePrimitive('box', pinkMaterial, new pc.Vec3(0.36, 3.18, -0.48), new pc.Vec3(0.28, 0.28, 0.28), 'pink-cube'));
      return;
    }

    if (id === 'shapes') {
      root.addChild(this.makePrimitive('sphere', blueMaterial, new pc.Vec3(-0.72, 2.95, 0), new pc.Vec3(0.32, 0.32, 0.32), 'shape-sphere'));
      root.addChild(this.makePrimitive('cone', pinkMaterial, new pc.Vec3(0, 2.95, 0), new pc.Vec3(0.3, 0.46, 0.3), 'shape-cone'));
      root.addChild(this.makePrimitive('box', whiteMaterial, new pc.Vec3(0.72, 2.95, 0), new pc.Vec3(0.34, 0.34, 0.34), 'shape-box'));
      root.addChild(this.makePrimitive('box', purpleMaterial, new pc.Vec3(0, 3.28, -0.42), new pc.Vec3(0.28, 0.28, 0.28), 'shape-diamond'));
      return;
    }

    if (id === 'count') {
      for (let index = 0; index < 4; index += 1) {
        root.addChild(this.makePrimitive('cylinder', yellowMaterial, new pc.Vec3(-0.72 + index * 0.48, 3.02, 0.18), new pc.Vec3(0.09, 0.42, 0.09), `pencil-front-${index}`));
        root.addChild(this.makePrimitive('cylinder', yellowMaterial, new pc.Vec3(-0.72 + index * 0.48, 3.02, -0.18), new pc.Vec3(0.09, 0.42, 0.09), `pencil-back-${index}`));
      }
      return;
    }

    if (id === 'memory') {
      root.addChild(this.makePrimitive('box', pinkMaterial, new pc.Vec3(-0.72, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-pink'));
      root.addChild(this.makePrimitive('box', blueMaterial, new pc.Vec3(0, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-blue'));
      root.addChild(this.makePrimitive('box', yellowMaterial, new pc.Vec3(0.72, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-yellow'));
      root.addChild(this.makePrimitive('box', greenMaterial, new pc.Vec3(0, 3.16, -0.42), new pc.Vec3(0.32, 0.08, 0.32), 'memory-mint'));
      return;
    }

    if (id === 'rhythm') {
      const noteOffsets = [-0.72, -0.24, 0.24, 0.72];
      noteOffsets.forEach((offset, index) => {
        root.addChild(this.makePrimitive('box', index % 2 === 0 ? purpleMaterial : blueMaterial, new pc.Vec3(offset, 2.95, 0), new pc.Vec3(0.24, 0.6, 0.9), `rhythm-key-${index}`));
      });
      return;
    }

    [-0.8, -0.4, 0, 0.4, 0.8].forEach((offset, index) => {
      root.addChild(
        this.makePrimitive(
          'box',
          index % 2 === 0 ? pinkMaterial : whiteMaterial,
          new pc.Vec3(offset, 2.95, 0),
          new pc.Vec3(0.22, 0.44, 0.44),
          `switch-column-${index}`,
        ),
      );
    });
  }

  private createDecor(): void {
    const deskMaterial = this.makeMaterial([0.78, 0.57, 0.35], [0.09, 0.06, 0.03]);
    const legMaterial = this.makeMaterial([0.54, 0.67, 0.94], [0.03, 0.05, 0.09]);
    const boardMaterial = this.makeMaterial([0.35, 0.71, 0.59], [0.05, 0.1, 0.08]);
    const shelfMaterial = this.makeMaterial([0.99, 0.92, 0.79], [0.08, 0.07, 0.05]);
    const artMaterial = this.makeMaterial([1, 0.89, 0.71], [0.08, 0.05, 0.03]);
    const bookMaterials = [
      this.makeMaterial([1, 0.53, 0.44], [0.05, 0.03, 0.03]),
      this.makeMaterial([0.48, 0.77, 1], [0.03, 0.05, 0.09]),
      this.makeMaterial([1, 0.82, 0.4], [0.08, 0.05, 0.01]),
    ];

    // Floating dust motes in sunbeam near windows
    const dustMaterial = this.makeMaterial([1, 0.98, 0.85], [0.6, 0.55, 0.35]);
    dustMaterial.emissiveIntensity = 1.8;
    dustMaterial.opacity = 0.35;
    dustMaterial.blendType = pc.BLEND_ADDITIVE;
    dustMaterial.depthWrite = false;
    dustMaterial.update();
    for (let i = 0; i < 12; i += 1) {
      const seed = (i * 3571 + 7919) % 7919;
      const dx = -8 + (seed % 160) / 10;
      const dy = 1.5 + ((seed * 3) % 40) / 10;
      const dz = 20 + ((seed * 7) % 60) / 10;
      const size = 0.06 + ((seed * 11) % 6) / 100;
      const mote = this.makePrimitive('sphere', dustMaterial, new pc.Vec3(dx, dy, dz), new pc.Vec3(size, size, size), `dust-mote-${i}`, false);
      this.app.root.addChild(mote);
      this.floatingEntities.push({ entity: mote, baseY: dy });
    }

    const board = this.makePrimitive('box', boardMaterial, new pc.Vec3(0, 3.2, 27.2), new pc.Vec3(11, 2.6, 0.16), 'chalk-board');
    this.app.root.addChild(board);
    this.app.root.addChild(this.makePrimitive('box', artMaterial, new pc.Vec3(-15.6, 3.1, -17.8), new pc.Vec3(4.6, 2.8, 0.2), 'art-board'));
    this.app.root.addChild(this.makePrimitive('box', artMaterial, new pc.Vec3(15.6, 3.1, -17.8), new pc.Vec3(4.6, 2.8, 0.2), 'switch-board'));
    const clueColors: Array<[number, number, number]> = [
      [1, 0.44, 0.41],
      [0.28, 0.57, 1],
      [1, 0.82, 0.4],
      [0.42, 0.88, 0.61],
      [1, 0.55, 0.79],
    ];
    clueColors.forEach((color, index) => {
      this.app.root.addChild(
        this.makePrimitive(
          'box',
          this.makeMaterial(color, [0.08, 0.08, 0.08]),
          new pc.Vec3(-3.6 + index * 1.8, 3.15, 27.02),
          new pc.Vec3(1.1, 1.9, 0.18),
          `color-poster-${index}`,
        ),
      );
    });

    const shapeBoard = new pc.Entity('shape-board-clues');
    shapeBoard.setPosition(-15.6, 3.1, -17.62);
    shapeBoard.addChild(this.makePrimitive('sphere', this.makeMaterial([0.41, 0.74, 1], [0.06, 0.08, 0.12]), new pc.Vec3(-1.4, 0.5, 0), new pc.Vec3(0.42, 0.42, 0.18), 'shape-clue-circle'));
    shapeBoard.addChild(this.makePrimitive('cone', this.makeMaterial([1, 0.66, 0.84], [0.1, 0.04, 0.06]), new pc.Vec3(-0.45, 0.45, 0), new pc.Vec3(0.34, 0.55, 0.24), 'shape-clue-triangle'));
    shapeBoard.addChild(this.makePrimitive('box', this.makeMaterial([1, 1, 1], [0.12, 0.12, 0.12]), new pc.Vec3(0.45, 0.45, 0), new pc.Vec3(0.42, 0.42, 0.18), 'shape-clue-square'));
    const diamond = this.makePrimitive('box', this.makeMaterial([0.72, 0.57, 1], [0.08, 0.04, 0.12]), new pc.Vec3(1.35, 0.45, 0), new pc.Vec3(0.42, 0.42, 0.18), 'shape-clue-diamond');
    diamond.setLocalEulerAngles(0, 0, 45);
    shapeBoard.addChild(diamond);
    this.app.root.addChild(shapeBoard);

    const switchDisplay = new pc.Entity('switch-display-clues');
    switchDisplay.setPosition(15.6, 3.1, -17.62);
    [true, false, true, true, false].forEach((isOn, index) => {
      switchDisplay.addChild(
        this.makePrimitive(
          'sphere',
          this.makeMaterial(isOn ? [1, 0.86, 0.43] : [0.36, 0.39, 0.45], isOn ? [0.22, 0.16, 0.04] : [0.04, 0.04, 0.04]),
          new pc.Vec3(-1.45 + index * 0.72, 0.55, 0),
          new pc.Vec3(0.2, 0.2, 0.12),
          `switch-clue-${index}`,
        ),
      );
    });
    this.app.root.addChild(switchDisplay);

    const musicBoard = new pc.Entity('music-board-clues');
    musicBoard.setPosition(0, 3.05, -22.9);
    [0.55, 1.05, 1.55, 1.9, 1.55].forEach((height, index) => {
      musicBoard.addChild(
        this.makePrimitive(
          'box',
          this.makeMaterial(index % 2 === 0 ? [0.72, 0.57, 1] : [0.41, 0.74, 1], [0.09, 0.05, 0.12]),
          new pc.Vec3(-1.8 + index * 0.9, height / 2, 0),
          new pc.Vec3(0.34, height, 0.18),
          `music-clue-${index}`,
        ),
      );
    });
    this.app.root.addChild(musicBoard);

    const deskPositions = [
      new pc.Vec3(-6.6, 0, 12.4),
      new pc.Vec3(6.6, 0, 12.4),
      new pc.Vec3(0, 0, 6.4),
      new pc.Vec3(-6.6, 0, 0.8),
      new pc.Vec3(6.6, 0, 0.8),
      new pc.Vec3(0, 0, -13.8),
    ];
    deskPositions.forEach((position, index) => {
      const desk = new pc.Entity(`desk-${index}`);
      desk.setPosition(position);
      desk.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 1.2, 0), new pc.Vec3(3.2, 0.25, 2), 'desk-top'));
      const legOffsets = [
        new pc.Vec3(-1.2, 0.55, -0.7),
        new pc.Vec3(1.2, 0.55, -0.7),
        new pc.Vec3(-1.2, 0.55, 0.7),
        new pc.Vec3(1.2, 0.55, 0.7),
      ];
      legOffsets.forEach((offset, legIndex) => {
        desk.addChild(this.makePrimitive('box', legMaterial, offset, new pc.Vec3(0.22, 1.1, 0.22), `desk-leg-${legIndex}`));
      });
      this.app.root.addChild(desk);
      this.obstacleMap.push({ x: position.x, z: position.z, radius: 1.75 });
    });

    const shelf = new pc.Entity('book-shelf');
    shelf.setPosition(17.1, 0, -11.8);
    shelf.addChild(this.makePrimitive('box', shelfMaterial, new pc.Vec3(0, 1.8, 0), new pc.Vec3(1.2, 3.5, 8.4), 'shelf-frame'));
    [-1.3, 0, 1.3].forEach((offset, index) => {
      shelf.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 0.8 + index, offset * 0.4), new pc.Vec3(1.22, 0.12, 7.8), `shelf-layer-${index}`));
    });
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const material = bookMaterials[(row + column) % bookMaterials.length];
        shelf.addChild(
          this.makePrimitive(
            'box',
            material,
            new pc.Vec3(-0.26 + (column % 2) * 0.17, 1.15 + row, -2.7 + column * 0.9),
            new pc.Vec3(0.12, 0.55, 0.42),
            `book-${row}-${column}`,
          ),
        );
      }
    }
    this.app.root.addChild(shelf);
    this.obstacleMap.push({ x: 17.1, z: -11.8, radius: 1.5 });

    const westShelf = new pc.Entity('west-shelf');
    westShelf.setPosition(-17.1, 0, -11.8);
    westShelf.addChild(this.makePrimitive('box', shelfMaterial, new pc.Vec3(0, 1.8, 0), new pc.Vec3(1.2, 3.5, 8.4), 'west-shelf-frame'));
    const globeStandMaterial = this.makeMaterial([0.42, 0.36, 0.28], [0.05, 0.04, 0.03]);
    const globeSphereMaterial = this.makeMaterial([0.35, 0.55, 0.78], [0.06, 0.1, 0.16]);
    globeSphereMaterial.emissiveIntensity = 0.8;
    globeSphereMaterial.update();
    westShelf.addChild(this.makePrimitive('cylinder', globeStandMaterial, new pc.Vec3(0, 3.7, 0), new pc.Vec3(0.12, 0.5, 0.12), 'globe-stand'));
    westShelf.addChild(this.makePrimitive('sphere', globeSphereMaterial, new pc.Vec3(0, 4.15, 0), new pc.Vec3(0.6, 0.6, 0.6), 'globe-sphere'));
    this.app.root.addChild(westShelf);
    this.obstacleMap.push({ x: -17.1, z: -11.8, radius: 1.5 });

    const countingDesk = new pc.Entity('counting-desk');
    countingDesk.setPosition(0, 0, 19.1);
    countingDesk.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 1.08, 0), new pc.Vec3(5.8, 0.2, 2.2), 'count-desk-top'));
    const pencilMaterial = this.makeMaterial([1, 0.83, 0.38], [0.08, 0.05, 0.01]);
    const crayonMaterial = this.makeMaterial([1, 0.53, 0.44], [0.08, 0.04, 0.03]);
    const eraserMaterial = this.makeMaterial([1, 0.68, 0.72], [0.08, 0.04, 0.05]);
    const rulerMaterial = this.makeMaterial([0.52, 0.76, 0.95], [0.04, 0.06, 0.08]);
    for (let index = 0; index < 8; index += 1) {
      const pencil = this.makePrimitive(
        'cylinder',
        pencilMaterial,
        new pc.Vec3(-1.8 + index * 0.5, 1.43, 0.2),
        new pc.Vec3(0.07, 0.42, 0.07),
        `desk-pencil-${index}`,
      );
      pencil.setEulerAngles(90, 0, 20);
      countingDesk.addChild(pencil);
    }
    for (let index = 0; index < 4; index += 1) {
      countingDesk.addChild(
        this.makePrimitive(
          'box',
          crayonMaterial,
          new pc.Vec3(-1.2 + index * 0.8, 1.34, -0.5),
          new pc.Vec3(0.26, 0.08, 0.18),
          `desk-crayon-${index}`,
        ),
      );
    }
    countingDesk.addChild(this.makePrimitive('box', eraserMaterial, new pc.Vec3(2.2, 1.24, -0.3), new pc.Vec3(0.38, 0.16, 0.22), 'desk-eraser'));
    const ruler = this.makePrimitive('box', rulerMaterial, new pc.Vec3(-2.4, 1.22, 0.5), new pc.Vec3(0.14, 0.04, 1.6), 'desk-ruler');
    ruler.setEulerAngles(0, 15, 0);
    countingDesk.addChild(ruler);
    countingDesk.addChild(this.makePrimitive('cylinder', this.makeMaterial([0.45, 0.55, 0.68], [0.04, 0.05, 0.06]), new pc.Vec3(2.4, 1.38, 0.3), new pc.Vec3(0.28, 0.4, 0.28), 'desk-pencil-cup'));
    this.app.root.addChild(countingDesk);
    this.obstacleMap.push({ x: 0, z: 19.1, radius: 2.1 });
  }

  private createPlayer(): void {
    this.playerRoot.setPosition(0, 0, PLAYER_START_Z);
    this.playerRoot.setEulerAngles(0, 180, 0);
    this.app.root.addChild(this.playerRoot);

    const skin = this.makeMaterial([1, 0.87, 0.67], [0.08, 0.06, 0.03]);
    const shirt = this.makeMaterial([0.39, 0.74, 1], [0.04, 0.07, 0.11]);
    const denim = this.makeMaterial([0.25, 0.42, 0.84], [0.03, 0.05, 0.09]);
    const hair = this.makeMaterial([0.42, 0.23, 0.1], [0.04, 0.02, 0.01]);
    const shoe = this.makeMaterial([0.26, 0.28, 0.38], [0.03, 0.03, 0.04]);
    const eye = this.makeMaterial([0.08, 0.1, 0.18], [0.01, 0.01, 0.02]);

    const parts = [
      this.makePrimitive('box', shirt, new pc.Vec3(0, 2.2, 0), new pc.Vec3(1.05, 1.25, 0.62), 'player-body'),
      this.makePrimitive('box', denim, new pc.Vec3(0, 1.5, 0.01), new pc.Vec3(1.08, 1.05, 0.66), 'player-overall'),
      this.makePrimitive('box', skin, new pc.Vec3(0, 3.38, 0), new pc.Vec3(0.9, 0.92, 0.82), 'player-head'),
      this.makePrimitive('box', hair, new pc.Vec3(0, 3.7, 0.13), new pc.Vec3(0.94, 0.36, 0.74), 'player-hair'),
      this.makePrimitive('box', eye, new pc.Vec3(-0.16, 3.38, 0.43), new pc.Vec3(0.08, 0.08, 0.02), 'player-eye-left'),
      this.makePrimitive('box', eye, new pc.Vec3(0.16, 3.38, 0.43), new pc.Vec3(0.08, 0.08, 0.02), 'player-eye-right'),
      this.makePrimitive('box', eye, new pc.Vec3(0, 3.08, 0.43), new pc.Vec3(0.18, 0.04, 0.02), 'player-mouth'),
      this.makePrimitive('box', skin, new pc.Vec3(-0.82, 2.12, 0), new pc.Vec3(0.24, 1.2, 0.24), 'player-arm-left'),
      this.makePrimitive('box', skin, new pc.Vec3(0.82, 2.12, 0), new pc.Vec3(0.24, 1.2, 0.24), 'player-arm-right'),
      this.makePrimitive('box', denim, new pc.Vec3(-0.26, 0.82, 0), new pc.Vec3(0.33, 1.28, 0.33), 'player-leg-left'),
      this.makePrimitive('box', denim, new pc.Vec3(0.26, 0.82, 0), new pc.Vec3(0.33, 1.28, 0.33), 'player-leg-right'),
      this.makePrimitive('box', shoe, new pc.Vec3(-0.26, 0.14, 0.11), new pc.Vec3(0.36, 0.22, 0.62), 'player-shoe-left'),
      this.makePrimitive('box', shoe, new pc.Vec3(0.26, 0.14, 0.11), new pc.Vec3(0.36, 0.22, 0.62), 'player-shoe-right'),
    ];

    parts.forEach((part) => {
      this.playerRoot.addChild(part);
    });
  }

  private createCamera(): void {
    if (!this.camera.camera) {
      this.camera.addComponent('camera', {
        clearColor: new pc.Color(0.86, 0.96, 1),
        fov: 64,
        farClip: 120,
        nearClip: 0.2,
      });
    }
    this.camera.setPosition(0, 7.8, 12.5);
    this.camera.lookAt(0, 1.8, PLAYER_START_Z - 6);
    this.app.root.addChild(this.camera);
  }

  private restoreStateFromProgress(): void {
    const solvedCount = countSolvedPuzzles(this.progress);

    this.puzzleStations.forEach((station, id) => {
      const solved = this.progress[id];
      station.highlightMaterial.diffuse = solved ? SOLVED_HIGHLIGHT_COLOR : station.baseColor;
      station.highlightMaterial.emissive = solved ? SOLVED_HIGHLIGHT_EMISSIVE : UNSOLVED_HIGHLIGHT_EMISSIVE;
      station.highlightMaterial.emissiveIntensity = solved ? 1.2 : 0.5;
      station.highlightMaterial.update();

      station.orbMaterial.diffuse = solved ? SOLVED_ORB_DIFFUSE : UNSOLVED_ORB_DIFFUSE;
      station.orbMaterial.emissive = solved ? SOLVED_ORB_EMISSIVE : UNSOLVED_ORB_EMISSIVE;
      station.orbMaterial.emissiveIntensity = solved ? 1.9 : 1.4;
      station.orbMaterial.update();
      station.orb.enabled = !solved;
    });

    PUZZLE_IDS.forEach((puzzleId, index) => {
      const slotEntity = this.doorSlots[index];
      const rawMaterial = slotEntity.render?.meshInstances[0]?.material;
      if (!(rawMaterial instanceof pc.StandardMaterial)) {
        return;
      }
      const slotMaterial = rawMaterial;

      const solved = this.progress[puzzleId];
      slotMaterial.diffuse = solved ? SOLVED_SLOT_DIFFUSE : UNSOLVED_SLOT_DIFFUSE;
      slotMaterial.emissive = solved ? SOLVED_SLOT_EMISSIVE : UNSOLVED_SLOT_EMISSIVE;
      slotMaterial.emissiveIntensity = solved ? 2 : 0.35;
      slotMaterial.update();
    });

    if (solvedCount >= 3) {
      this.researchGateOpenAmount = 1;
      this.researchGateObstacle.radius = 0;
      this.researchGateRoot.setLocalPosition(0, 4.6, -6.4);
    } else {
      this.researchGateOpenAmount = 0;
      this.researchGateObstacle.radius = 2.25;
      this.researchGateRoot.setLocalPosition(0, 0, -6.4);
    }

    if (this.progress.cleared) {
      this.doorOpenAmount = 1;
      this.doorRoot.setLocalPosition(0, 4.2, FINAL_DOOR_Z);
    }
  }

  private solvePuzzle(puzzleId: PuzzleId): void {
    if (this.progress[puzzleId]) {
      return;
    }

    this.progress = {
      ...this.progress,
      [puzzleId]: true,
    };
    this.progressStore.save(this.gameProgress);
    this.restoreStateFromProgress();

    const solvedCount = countSolvedPuzzles(this.progress);
    this.ui.setProgress(solvedCount, PUZZLE_IDS.length);
    this.updateObjective();
    this.updateHud();

    if (solvedCount === PUZZLE_IDS.length) {
      this.ui.showToast('별 조각을 모두 모았다. 최종 문 시험을 풀러 가자!');
    } else if (solvedCount === 3) {
      this.isResearchGateOpening = true;
      this.ui.showToast('앞 교실을 돌파했다. 중앙 연구 게이트가 열린다!');
    } else {
      this.ui.showToast('별 조각을 찾았다!');
    }
  }

  private update(dt: number): void {
    this.timeElapsed += dt;
    this.animateFloaters(dt);
    this.animateResearchGate(dt);
    this.animateDoor(dt);

    if (!this.ui.isBlockingGame() && !this.isTransitioning) {
      this.updateJumpPhysics(dt);
      const lookDelta = this.ui.consumeLookDelta();
      if (lookDelta.x !== 0 || lookDelta.y !== 0) {
        this.cameraDragIdle = 0;
      } else {
        this.cameraDragIdle += dt;
      }
      if (lookDelta.x !== 0) {
        this.cameraYaw = pc.math.clamp(
          this.cameraYaw - lookDelta.x * CAMERA_ROTATION_SENSITIVITY,
          -CAMERA_YAW_LIMIT,
          CAMERA_YAW_LIMIT,
        );
      }
      if (lookDelta.y !== 0) {
        this.cameraPitch = pc.math.clamp(this.cameraPitch + lookDelta.y * 0.05, CAMERA_PITCH_LIMIT_DOWN, CAMERA_PITCH_LIMIT_UP);
      }
      if (this.cameraDragIdle > 3.0) {
        const recenterBlend = 1 - Math.exp(-dt * 1.2);
        this.cameraYaw = pc.math.lerp(this.cameraYaw, 0, recenterBlend);
        this.cameraPitch = pc.math.lerp(this.cameraPitch, 6, recenterBlend * 0.5);
      }
      this.updatePlayerMovement(dt);
      this.updateNearestInteractable();
    } else {
      this.jumpKeyWasDown = false;
      this.playerVelocity.set(0, 0, 0);
      this.ui.setPrompt(null);
      this.nearestInteractable = null;
    }

    this.updateHud();
    this.updateCamera(dt);
    this.animateAvatar(dt);
    this.updateHintTimer(dt);
  }

  private updateHintTimer(dt: number): void {
    if (this.ui.isBlockingGame() || this.progress.cleared) {
      return;
    }

    this.hintTimer += dt;
    const solvedCount = countSolvedPuzzles(this.progress);
    if (solvedCount >= PUZZLE_IDS.length) {
      return;
    }

    if (this.hintTimer > 90 && this.hintTimer - dt <= 90) {
      this.ui.showToast('주변 가구 아래나 뒤쪽을 잘 살펴보자.');
    }
    if (this.hintTimer > 180 && this.hintTimer - dt <= 180) {
      this.ui.showToast('위를 올려다보거나 좁은 틈을 확인해 보자.');
    }
  }

  private updateHud(): void {
    const playerPosition = this.playerRoot.getPosition();
    const normalize = (value: number, halfSize: number): number => ((value + halfSize) / (halfSize * 2)) * 100;
    const zoneLabel = this.currentStage === 1
      ? (playerPosition.z > 6 ? '앞 교실' : playerPosition.z > -8 ? '중앙 통로' : '연구 구역')
      : (playerPosition.z > 6 ? '정원 앞쪽' : playerPosition.z > -8 ? '정원 중앙' : '정원 안쪽');
    if (zoneLabel !== this.lastZoneLabel) {
      if (this.lastZoneLabel !== null) {
        this.ui.showZoneBanner(zoneLabel);
      }
      this.lastZoneLabel = zoneLabel;
      this.ui.setZoneLabel(zoneLabel);
    }
    const markers = this._minimapMarkers;
    PUZZLE_IDS.forEach((puzzleId, i) => {
      const station = this.puzzleStations.get(puzzleId);
      const position = station?.entity.getPosition() ?? pc.Vec3.ZERO;
      markers[i].x = normalize(position.x, ROOM_HALF_WIDTH);
      markers[i].y = normalize(-position.z, ROOM_HALF_DEPTH);
      markers[i].solved = this.progress[puzzleId];
    });

    const solvedCount = countSolvedPuzzles(this.progress);
    const backZone = this.currentStage === 1 ? '연구 구역' : '정원 안쪽';
    const targetPosition =
      solvedCount >= PUZZLE_IDS.length
        ? this.doorRoot.getPosition()
        : solvedCount >= 3 && zoneLabel !== backZone
          ? this.researchGateRoot.getPosition()
          : null;

    this.ui.setMinimap({
      zoneLabel,
      player: {
        x: normalize(playerPosition.x, ROOM_HALF_WIDTH),
        y: normalize(-playerPosition.z, ROOM_HALF_DEPTH),
      },
      target: targetPosition
        ? {
            x: normalize(targetPosition.x, ROOM_HALF_WIDTH),
            y: normalize(-targetPosition.z, ROOM_HALF_DEPTH),
          }
        : null,
      markers,
    });
  }

  private refreshChecklist(): void {
    const defs = this.currentStage === 1 ? PUZZLE_DEFINITIONS : STAGE_2_DEFINITIONS;
    const frontZone = this.currentStage === 1 ? '앞 교실' : '정원 앞쪽';
    const backZone = this.currentStage === 1 ? '연구 구역' : '정원 안쪽';
    this.ui.setChecklist(
      PUZZLE_IDS.map((puzzleId) => ({
        label: defs[puzzleId].title,
        zone: puzzleId === 'colors' || puzzleId === 'shapes' || puzzleId === 'count' ? frontZone : backZone,
        solved: this.progress[puzzleId],
      })),
    );
  }

  private updatePlayerMovement(dt: number): void {
    const keyboard = this.app.keyboard;
    const jumpKeyDown = keyboard?.isPressed(pc.KEY_SPACE) ?? false;
    const jumpRequested = this.ui.consumeJumpRequest() || (jumpKeyDown && !this.jumpKeyWasDown);
    this.jumpKeyWasDown = jumpKeyDown;

    const actionKeyDown = !!(keyboard?.isPressed(pc.KEY_E) || keyboard?.isPressed(pc.KEY_RETURN));
    if (actionKeyDown && !this._actionKeyWasDown && !this.ui.isBlockingGame()) {
      this.handleAction();
    }
    this._actionKeyWasDown = actionKeyDown;
    if (jumpRequested && this.playerHeight <= 0.001 && !this.pendingJump) {
      this.pendingJump = true;
      this.jumpCharge = 0.075;
    }

    if (this.pendingJump) {
      this.jumpCharge -= dt;
      if (this.jumpCharge <= 0) {
        this.pendingJump = false;
        this.verticalVelocity = 9.8;
      }
    }

    const joystick = this.ui.getMoveVector();
    const moveX =
      (keyboard?.isPressed(pc.KEY_D) || keyboard?.isPressed(pc.KEY_RIGHT) ? 1 : 0) -
      (keyboard?.isPressed(pc.KEY_A) || keyboard?.isPressed(pc.KEY_LEFT) ? 1 : 0) +
      joystick.x;
    const moveZ =
      (keyboard?.isPressed(pc.KEY_S) || keyboard?.isPressed(pc.KEY_DOWN) ? 1 : 0) -
      (keyboard?.isPressed(pc.KEY_W) || keyboard?.isPressed(pc.KEY_UP) ? 1 : 0) +
      joystick.y;

    const input = this._inputVec;
    input.set(moveX, 0, moveZ);
    const hasInput = input.lengthSq() > 0.0001;
    if (hasInput && input.lengthSq() > 1) {
      input.normalize();
    }

    const yawRadians = this.cameraYaw * pc.math.DEG_TO_RAD;
    const forward = this._forwardVec;
    forward.set(-Math.sin(yawRadians), 0, -Math.cos(yawRadians));
    const right = this._rightVec;
    right.set(Math.cos(yawRadians), 0, -Math.sin(yawRadians));
    const desiredDirection = this._desiredDir;
    desiredDirection.set(0, 0, 0);

    if (hasInput) {
      desiredDirection.add2(right.mulScalar(input.x), forward.mulScalar(-input.z));
      if (desiredDirection.lengthSq() > 1) {
        desiredDirection.normalize();
      }
    }

    const targetSpeed = this.playerHeight > 0.02 ? PLAYER_AIR_SPEED : PLAYER_MOVE_SPEED;
    const targetVelocity = desiredDirection.mulScalar(targetSpeed);
    const response =
      hasInput
        ? 1 - Math.exp(-dt * (this.playerHeight > 0.02 ? PLAYER_AIR_ACCELERATION : PLAYER_ACCELERATION))
        : 1 - Math.exp(-dt * PLAYER_DECELERATION);

    this.playerVelocity.x = pc.math.lerp(this.playerVelocity.x, targetVelocity.x, response);
    this.playerVelocity.z = pc.math.lerp(this.playerVelocity.z, targetVelocity.z, response);

    if (!hasInput && Math.hypot(this.playerVelocity.x, this.playerVelocity.z) < 0.05) {
      this.playerVelocity.x = 0;
      this.playerVelocity.z = 0;
    }

    const position = this.playerRoot.getPosition();
    const candidate = this._candidatePos;
    candidate.set(
      position.x + this.playerVelocity.x * dt,
      this.playerHeight,
      position.z + this.playerVelocity.z * dt,
    );

    candidate.x = pc.math.clamp(candidate.x, -ROOM_HALF_WIDTH + 1.5, ROOM_HALF_WIDTH - 1.5);
    candidate.z = pc.math.clamp(candidate.z, -ROOM_HALF_DEPTH + 2.2, ROOM_HALF_DEPTH - 2.5);

    this.obstacleMap.forEach((obstacle) => {
      const deltaX = candidate.x - obstacle.x;
      const deltaZ = candidate.z - obstacle.z;
      const distance = Math.hypot(deltaX, deltaZ);
      const minDistance = obstacle.radius + PLAYER_RADIUS;
      if (distance > 0 && distance < minDistance) {
        const push = minDistance - distance;
        candidate.x += (deltaX / distance) * push;
        candidate.z += (deltaZ / distance) * push;
      }
    });

    this.playerRoot.setPosition(candidate.x, this.playerHeight, candidate.z);

    const horizontalSpeed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
    if (horizontalSpeed > 0.12) {
      const targetYaw = Math.atan2(this.playerVelocity.x, this.playerVelocity.z) * pc.math.RAD_TO_DEG;
      const currentYaw = this.playerRoot.getEulerAngles().y;
      const rotationBlend = 1 - Math.exp(-dt * 12);
      const nextYaw = pc.math.lerpAngle(currentYaw, targetYaw, rotationBlend);
      this.playerRoot.setEulerAngles(0, nextYaw, 0);
      this.walkCycle += dt * (7 + horizontalSpeed * 0.75);
      return;
    }

    // walkCycle decay handled in animateAvatar
  }

  private updateNearestInteractable(): void {
    const playerPosition = this.playerRoot.getPosition();
    let nearest: Interactable | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const interactable of this.interactables) {
      if (interactable.kind === 'puzzle' && this.progress[interactable.id]) {
        continue;
      }

      const interactRadius = this.currentStage === 1 ? 2.7 : 3.2;
      const worldPosition = interactable.entity.getPosition();
      const distance = Math.hypot(worldPosition.x - playerPosition.x, worldPosition.z - playerPosition.z);
      if (distance < interactRadius && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    if (this.nearestInteractable && this.nearestInteractable !== nearest && this.nearestInteractable.kind === 'puzzle') {
      const prev = this.nearestInteractable;
      prev.highlightMaterial.emissiveIntensity = this.progress[prev.id] ? 1.2 : 0.5;
      prev.highlightMaterial.update();
    }

    this.nearestInteractable = nearest;
    if (nearest) {
      if (nearest.kind === 'puzzle') {
        const pulse = 1.4 + Math.sin(this.timeElapsed * 4) * 0.4;
        nearest.highlightMaterial.emissiveIntensity = pulse;
        nearest.highlightMaterial.update();
      }
      if (nearest.kind === 'door') {
        const solvedCount = countSolvedPuzzles(this.progress);
        nearest.prompt.detail =
          solvedCount === PUZZLE_IDS.length
            ? '앞과 뒤 구역 단서를 다시 조합하는 최종 문 시험을 시작하자.'
            : `별 조각 ${PUZZLE_IDS.length - solvedCount}개가 더 필요하다.`;
        nearest.prompt.actionLabel = solvedCount === PUZZLE_IDS.length ? '시험 시작' : '문 확인';
      }
      this.ui.setPrompt(nearest.prompt);
      return;
    }

    this.ui.setPrompt(null);
  }

  private updateCamera(dt: number): void {
    const playerPosition = this.playerRoot.getPosition();
    const canvas = this.app.graphicsDevice.canvas as HTMLCanvasElement;
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    const isPortrait = aspect < 0.85;
    const cameraHeight = isPortrait ? 9.2 : 7.6;
    const cameraDistance = isPortrait ? 11.6 : 10.1;
    const yawRadians = this.cameraYaw * pc.math.DEG_TO_RAD;
    const right = this._camRight;
    right.set(Math.cos(yawRadians), 0, -Math.sin(yawRadians));
    const leadStrength = isPortrait ? 0.18 : 0.22;
    const lead = this._camLead;
    lead.set(this.playerVelocity.x * leadStrength, 0, this.playerVelocity.z * leadStrength);
    const shoulderOffset = isPortrait ? 0.16 : 0.28;
    const desiredPosition = this._camDesired;
    desiredPosition.set(
      pc.math.clamp(playerPosition.x + Math.sin(yawRadians) * cameraDistance + right.x * shoulderOffset, -ROOM_HALF_WIDTH + 3, ROOM_HALF_WIDTH - 3),
      cameraHeight,
      pc.math.clamp(playerPosition.z + Math.cos(yawRadians) * cameraDistance + right.z * shoulderOffset, -ROOM_HALF_DEPTH + 4, ROOM_HALF_DEPTH - 4),
    );
    const current = this.camera.getPosition();
    const isMoving = Math.hypot(this.playerVelocity.x, this.playerVelocity.z) > 0.5;
    const cameraLag = isMoving ? 5.5 : 9.0;
    const blend = 1 - Math.exp(-dt * cameraLag);
    const next = this._camNext;
    next.set(
      pc.math.lerp(current.x, desiredPosition.x, blend),
      pc.math.lerp(current.y, desiredPosition.y, blend),
      pc.math.lerp(current.z, desiredPosition.z, blend),
    );
    this.camera.setPosition(next);
    this.camera.lookAt(
      playerPosition.x + lead.x + right.x * 0.1,
      2.15 + this.playerHeight * 0.24 + this.cameraPitch * 0.03 - this.landingBounce * 0.05,
      playerPosition.z - (isPortrait ? 3 : 4) + lead.z + right.z * 0.1,
    );
  }

  private animateAvatar(dt: number): void {
    const speed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
    const moving = !this.ui.isBlockingGame() && speed > 0.12;
    const airborne = this.playerHeight > 0.02;
    const stride = Math.min(1, speed / PLAYER_MOVE_SPEED);
    const swing = moving ? Math.sin(this.walkCycle) * (18 + stride * 8) : 0;
    const bodyLean = moving ? Math.min(16, speed * 1.2) : 0;
    const bounce = moving ? Math.sin(this.walkCycle * 0.5) * 0.05 * stride : 0;
    this.landingBounce = Math.max(0, this.landingBounce - dt * LANDING_BOUNCE_DECAY);
    const chargeCrouch = this.pendingJump ? Math.max(0, this.jumpCharge / 0.075) * 0.09 : 0;
    const squashY = 1 - this.landingBounce * 0.08 - chargeCrouch;
    const squashXZ = 1 + this.landingBounce * 0.05 + chargeCrouch * 0.5;
    this.playerRoot.setLocalScale(squashXZ, squashY, squashXZ);
    this.playerRoot.findByName('player-body')?.setLocalEulerAngles(airborne ? -18 : -bodyLean, 0, 0);
    this.playerRoot.findByName('player-head')?.setLocalPosition(0, 3.38 + bounce, 0);
    this.playerRoot.findByName('player-arm-left')?.setLocalEulerAngles(airborne ? -28 : swing, 0, 0);
    this.playerRoot.findByName('player-arm-right')?.setLocalEulerAngles(airborne ? -28 : -swing, 0, 0);
    this.playerRoot.findByName('player-leg-left')?.setLocalEulerAngles(airborne ? 18 : -swing, 0, 0);
    this.playerRoot.findByName('player-leg-right')?.setLocalEulerAngles(airborne ? 18 : swing, 0, 0);

    if (!moving && this.walkCycle > 0) {
      this.walkCycle = Math.max(0, this.walkCycle - dt * 8);
      if (this.walkCycle < 0.15) {
        this.walkCycle = 0;
      }
    }
  }

  private updateJumpPhysics(dt: number): void {
    const gravity = 24;
    this.verticalVelocity -= gravity * dt;
    this.playerHeight += this.verticalVelocity * dt;
    const airborne = this.playerHeight > 0.02 || this.verticalVelocity > 0.02;

    if (this.playerHeight <= 0) {
      if (this.wasAirborne) {
        this.landingBounce = 1;
      }
      this.playerHeight = 0;
      this.verticalVelocity = 0;
    }
    this.wasAirborne = airborne && this.playerHeight > 0;

    const position = this.playerRoot.getPosition();
    if (position.y !== this.playerHeight) {
      this.playerRoot.setPosition(position.x, this.playerHeight, position.z);
    }
  }

  private animateFloaters(dt: number): void {
    this.floatingEntities.forEach(({ entity, baseY }, index) => {
      const pos = entity.getLocalPosition();
      entity.setLocalPosition(pos.x, baseY + Math.sin(this.timeElapsed * 2.2 + index) * 0.12, pos.z);
      entity.rotateLocal(0, dt * 42, 0);
    });
  }

  private animateResearchGate(dt: number): void {
    if (!this.isResearchGateOpening && this.researchGateOpenAmount <= 0) {
      return;
    }

    this.researchGateOpenAmount = Math.min(1, this.researchGateOpenAmount + dt * 0.9);
    const eased = pc.math.smoothstep(0, 1, this.researchGateOpenAmount);
    this.researchGateRoot.setLocalPosition(0, eased * 4.6, -6.4);
    this.researchGateObstacle.radius = this.researchGateOpenAmount >= 1 ? 0 : 2.25;
    if (this.researchGateOpenAmount >= 1) {
      this.isResearchGateOpening = false;
    }
  }

  private animateDoor(dt: number): void {
    if (!this.isDoorOpening && !this.progress.cleared) {
      return;
    }

    this.doorOpenAmount = Math.min(1, this.doorOpenAmount + dt * 0.7);
    const eased = pc.math.smoothstep(0, 1, this.doorOpenAmount);
    this.doorRoot.setLocalPosition(0, eased * 4.2, FINAL_DOOR_Z);

    if (this.doorOpenAmount >= 1 && !this.clearShown) {
      this.clearShown = true;
      this.progress = { ...this.progress, cleared: true };
      this.progressStore.save(this.gameProgress);
      this.updateObjective();
      this.ui.showClear();
    }
  }

  private updateObjective(): void {
    const solvedCount = countSolvedPuzzles(this.progress);
    const stageTitle = this.currentStage === 1 ? STAGE_TITLE : STAGE_2_TITLE;
    const remaining = PUZZLE_IDS.length - solvedCount;

    if (this.progress.cleared) {
      this.ui.setObjective(`${stageTitle} 클리어`, this.currentStage === 1
        ? '긴 교실과 연구 구역을 모두 돌파했다. 별빛 정원이 기다린다.'
        : '별빛 정원의 모든 퍼즐을 풀었다. 축하해!');
      return;
    }

    if (solvedCount === PUZZLE_IDS.length) {
      this.ui.setObjective(
        this.currentStage === 1 ? '북쪽 무지개 문으로 가자' : '마법의 문으로 가자',
        this.currentStage === 1
          ? '별 조각 여섯 개를 모두 모았다. 가장 안쪽 탈출 문으로 달려가자.'
          : '별빛 조각 여섯 개를 모두 모았다. 마법의 문으로 달려가자.');
      return;
    }

    if (solvedCount < 3) {
      this.ui.setObjective(
        this.currentStage === 1 ? '앞쪽 교실 단서를 모으자' : '정원 앞쪽을 탐색하자',
        `퍼즐을 먼저 정리하자. 진행 ${solvedCount} / ${PUZZLE_IDS.length}, 남은 별 조각 ${remaining}개.`);
      return;
    }

    this.ui.setObjective(
      this.currentStage === 1 ? '뒤쪽 연구 구역을 돌파하자' : '정원 안쪽을 돌파하자',
      `${this.currentStage === 1 ? '연구 구역' : '정원 안쪽'} 퍼즐이 남아 있다. 진행 ${solvedCount} / ${PUZZLE_IDS.length}, 남은 별 조각 ${remaining}개.`);
  }

  async transitionToStage2(): Promise<void> {
    if (this.isTransitioning || this.currentStage === 2) {
      return;
    }

    this.isTransitioning = true;
    try {
      await this.ui.showTransition('별빛 정원으로 이동 중...');

      this.clearScene();
      this.currentStage = 2;
      this.gameProgress.stage = 2;
      this.clearShown = false;
      this.isResearchGateOpening = false;
      this.researchGateOpenAmount = 0;
      this.isDoorOpening = false;
      this.doorOpenAmount = 0;
      this.hintTimer = 0;
      this.playerHeight = 0;
      this.verticalVelocity = 0;
      this.landingBounce = 0;
      this.wasAirborne = false;
      this.playerVelocity.set(0, 0, 0);
      this.cameraYaw = 0;
      this.cameraPitch = 6;
      this.lastZoneLabel = null;
      this.nearestInteractable = null;
      this._actionKeyWasDown = false;

      // Reset camera position to starting view before fade-out
      this.camera.setPosition(0, 7.8, PLAYER_START_Z + 12.5);
      this.camera.lookAt(0, 1.8, PLAYER_START_Z - 6);

      // Tell UI we're now in stage 2
      this.ui.setStage(2);

      // Rebuild player and scene with Room 2
      this.buildRoom2();
      this.restoreStateFromProgress();
      this.refreshChecklist();
      this.updateHud();
      this.updateObjective();
      this.ui.setProgress(countSolvedPuzzles(this.progress), PUZZLE_IDS.length);
      this.ui.updateBrandTitle(STAGE_2_TITLE, STAGE_2_SUBTITLE);
      this.ui.updateClearText(
        `${STAGE_2_TITLE} 돌파 성공`,
        '별빛 정원의 모든 퍼즐을 풀었다. 축하해!',
        '교실부터 다시 시작',
      );
      this.progressStore.save(this.gameProgress);

      // Fade in
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      this.ui.hideTransition();
      this.ui.showToast('별빛 정원에 도착했다. 숨겨진 퍼즐을 찾아보자!');
    } finally {
      this.isTransitioning = false;
    }
  }

  private buildRoom2(): void {
    // Create player and camera first
    this.createPlayer();

    // Garden floor - dark grass
    const grassMaterial = this.makeMaterial([0.22, 0.42, 0.28], [0.04, 0.08, 0.03]);
    const pathMaterial = this.makeMaterial([0.55, 0.48, 0.35], [0.06, 0.05, 0.03]);
    const stoneMaterial = this.makeMaterial([0.52, 0.55, 0.58], [0.06, 0.06, 0.07]);
    const fenceMaterial = this.makeMaterial([0.58, 0.42, 0.25], [0.08, 0.06, 0.03]);
    const treeTrunkMaterial = this.makeMaterial([0.45, 0.3, 0.15], [0.06, 0.04, 0.02]);
    const leafMaterial = this.makeMaterial([0.28, 0.55, 0.32], [0.05, 0.12, 0.06]);
    const darkLeafMaterial = this.makeMaterial([0.18, 0.4, 0.22], [0.03, 0.08, 0.04]);
    const flowerMaterials = [
      this.makeMaterial([1, 0.55, 0.65], [0.2, 0.08, 0.1]),
      this.makeMaterial([0.65, 0.55, 1], [0.1, 0.08, 0.2]),
      this.makeMaterial([1, 0.85, 0.45], [0.2, 0.15, 0.05]),
    ];
    const lanternMaterial = this.makeMaterial([1, 0.9, 0.6], [0.8, 0.65, 0.3]);
    lanternMaterial.emissiveIntensity = 2.2;
    lanternMaterial.update();

    // Night sky color
    const cameraComponent = this.camera.camera;
    if (cameraComponent) {
      cameraComponent.clearColor = new pc.Color(0.08, 0.1, 0.2);
    }
    this.app.scene.ambientLight = new pc.Color(0.18, 0.2, 0.32);

    // Update sun to moonlight
    const sun = this.app.root.findByName('sun') as pc.Entity | null;
    if (sun?.light) {
      sun.light.color = new pc.Color(0.4, 0.45, 0.7);
      sun.light.intensity = 0.8;
    }
    const fill = this.app.root.findByName('fill') as pc.Entity | null;
    if (fill?.light) {
      fill.light.color = new pc.Color(0.3, 0.35, 0.6);
      fill.light.intensity = 0.6;
    }

    // Floor
    this.app.root.addChild(this.makePrimitive('box', grassMaterial, new pc.Vec3(0, -0.5, 0), new pc.Vec3(ROOM_HALF_WIDTH * 2, 1, ROOM_HALF_DEPTH * 2), 'garden-floor'));

    // Stone path
    this.app.root.addChild(this.makePrimitive('box', pathMaterial, new pc.Vec3(0, -0.02, 0), new pc.Vec3(3.5, 0.08, ROOM_HALF_DEPTH * 2), 'garden-path'));

    // Fence walls
    const fenceHeight = 2.2;
    this.app.root.addChild(this.makePrimitive('box', fenceMaterial, new pc.Vec3(-ROOM_HALF_WIDTH - 0.5, fenceHeight / 2, 0), new pc.Vec3(1, fenceHeight, ROOM_HALF_DEPTH * 2), 'fence-west'));
    this.app.root.addChild(this.makePrimitive('box', fenceMaterial, new pc.Vec3(ROOM_HALF_WIDTH + 0.5, fenceHeight / 2, 0), new pc.Vec3(1, fenceHeight, ROOM_HALF_DEPTH * 2), 'fence-east'));
    this.app.root.addChild(this.makePrimitive('box', fenceMaterial, new pc.Vec3(0, fenceHeight / 2, ROOM_HALF_DEPTH + 0.5), new pc.Vec3(ROOM_HALF_WIDTH * 2 + 1, fenceHeight, 1), 'fence-south'));
    this.app.root.addChild(this.makePrimitive('box', fenceMaterial, new pc.Vec3(-9.5, fenceHeight / 2, -ROOM_HALF_DEPTH - 0.5), new pc.Vec3(21, fenceHeight, 1), 'fence-north-left'));
    this.app.root.addChild(this.makePrimitive('box', fenceMaterial, new pc.Vec3(9.5, fenceHeight / 2, -ROOM_HALF_DEPTH - 0.5), new pc.Vec3(21, fenceHeight, 1), 'fence-north-right'));

    // Night sky dome
    const skyMaterial = this.makeMaterial([0.06, 0.08, 0.16], [0.02, 0.03, 0.06]);
    this.app.root.addChild(this.makePrimitive('sphere', skyMaterial, new pc.Vec3(0, -5, 0), new pc.Vec3(80, 40, 80), 'sky-dome', false));

    // Trees
    const treePositions = [
      new pc.Vec3(-15, 0, 20), new pc.Vec3(15, 0, 20),
      new pc.Vec3(-16, 0, 5), new pc.Vec3(16, 0, 5),
      new pc.Vec3(-15, 0, -12), new pc.Vec3(15, 0, -12),
      new pc.Vec3(-8, 0, -22), new pc.Vec3(8, 0, -22),
    ];
    treePositions.forEach((position, index) => {
      const tree = new pc.Entity(`tree-${index}`);
      tree.setPosition(position);
      tree.addChild(this.makePrimitive('cylinder', treeTrunkMaterial, new pc.Vec3(0, 2, 0), new pc.Vec3(0.8, 4, 0.8), `trunk-${index}`));
      tree.addChild(this.makePrimitive('sphere', index % 2 === 0 ? leafMaterial : darkLeafMaterial, new pc.Vec3(0, 5, 0), new pc.Vec3(4, 3.5, 4), `canopy-${index}`));
      this.app.root.addChild(tree);
      this.obstacleMap.push({ x: position.x, z: position.z, radius: 1.5 });
    });

    // Rocks
    const rockPositions = [
      new pc.Vec3(-10, 0, 14), new pc.Vec3(10, 0, 14),
      new pc.Vec3(-6, 0, -8), new pc.Vec3(6, 0, -8),
    ];
    rockPositions.forEach((position, index) => {
      this.app.root.addChild(this.makePrimitive('sphere', stoneMaterial, new pc.Vec3(position.x, 0.5, position.z), new pc.Vec3(1.8, 1.2, 1.5), `rock-${index}`));
      this.obstacleMap.push({ x: position.x, z: position.z, radius: 1.2 });
    });

    // Flower beds
    const flowerBedPositions = [
      new pc.Vec3(-11, 0, 8), new pc.Vec3(11, 0, 8),
      new pc.Vec3(-11, 0, -4), new pc.Vec3(11, 0, -4),
    ];
    flowerBedPositions.forEach((position, index) => {
      for (let j = 0; j < 5; j += 1) {
        const fx = position.x + (j - 2) * 0.8;
        const fz = position.z + Math.sin(j) * 0.5;
        const material = flowerMaterials[(index + j) % flowerMaterials.length];
        this.app.root.addChild(this.makePrimitive('sphere', material, new pc.Vec3(fx, 0.3, fz), new pc.Vec3(0.4, 0.5, 0.4), `flower-${index}-${j}`));
      }
    });

    // Garden bench
    const benchMaterial = this.makeMaterial([0.5, 0.38, 0.22], [0.07, 0.05, 0.03]);
    const bench = new pc.Entity('garden-bench');
    bench.setPosition(-7, 0, 0);
    bench.addChild(this.makePrimitive('box', benchMaterial, new pc.Vec3(0, 0.55, 0), new pc.Vec3(2.8, 0.18, 0.9), 'bench-seat'));
    bench.addChild(this.makePrimitive('box', benchMaterial, new pc.Vec3(0, 1.2, -0.38), new pc.Vec3(2.8, 1.1, 0.14), 'bench-back'));
    bench.addChild(this.makePrimitive('box', benchMaterial, new pc.Vec3(-1.2, 0.28, 0), new pc.Vec3(0.18, 0.55, 0.7), 'bench-leg-l'));
    bench.addChild(this.makePrimitive('box', benchMaterial, new pc.Vec3(1.2, 0.28, 0), new pc.Vec3(0.18, 0.55, 0.7), 'bench-leg-r'));
    this.app.root.addChild(bench);
    this.obstacleMap.push({ x: -7, z: 0, radius: 1.6 });

    // Stone well
    const wellMaterial = this.makeMaterial([0.48, 0.5, 0.52], [0.05, 0.05, 0.06]);
    const well = new pc.Entity('garden-well');
    well.setPosition(7, 0, 0);
    well.addChild(this.makePrimitive('cylinder', wellMaterial, new pc.Vec3(0, 0.6, 0), new pc.Vec3(1.8, 1.2, 1.8), 'well-base'));
    well.addChild(this.makePrimitive('cylinder', this.makeMaterial([0.15, 0.2, 0.35], [0.02, 0.03, 0.06]), new pc.Vec3(0, 0.1, 0), new pc.Vec3(1.3, 0.3, 1.3), 'well-water'));
    well.addChild(this.makePrimitive('cylinder', treeTrunkMaterial, new pc.Vec3(-0.8, 1.8, 0), new pc.Vec3(0.12, 2.4, 0.12), 'well-post-l'));
    well.addChild(this.makePrimitive('cylinder', treeTrunkMaterial, new pc.Vec3(0.8, 1.8, 0), new pc.Vec3(0.12, 2.4, 0.12), 'well-post-r'));
    well.addChild(this.makePrimitive('box', treeTrunkMaterial, new pc.Vec3(0, 3.05, 0), new pc.Vec3(2, 0.14, 0.5), 'well-beam'));
    this.app.root.addChild(well);
    this.obstacleMap.push({ x: 7, z: 0, radius: 1.3 });

    // Mushroom cluster
    const mushroomCapMaterial = this.makeMaterial([0.9, 0.3, 0.35], [0.15, 0.04, 0.05]);
    const mushroomStemMaterial = this.makeMaterial([0.92, 0.88, 0.78], [0.08, 0.07, 0.06]);
    [new pc.Vec3(-14, 0, -14), new pc.Vec3(-13.3, 0, -13.5), new pc.Vec3(-14.5, 0, -13.2)].forEach((pos, i) => {
      const scale = 0.6 + i * 0.15;
      this.app.root.addChild(this.makePrimitive('cylinder', mushroomStemMaterial, new pc.Vec3(pos.x, 0.25 * scale, pos.z), new pc.Vec3(0.15 * scale, 0.5 * scale, 0.15 * scale), `mushroom-stem-${i}`, false));
      this.app.root.addChild(this.makePrimitive('sphere', mushroomCapMaterial, new pc.Vec3(pos.x, 0.55 * scale, pos.z), new pc.Vec3(0.4 * scale, 0.22 * scale, 0.4 * scale), `mushroom-cap-${i}`, false));
    });

    // Lanterns along the path
    const lanternPositions = [
      new pc.Vec3(-3, 0, 16), new pc.Vec3(3, 0, 16),
      new pc.Vec3(-3, 0, 4), new pc.Vec3(3, 0, 4),
      new pc.Vec3(-3, 0, -10), new pc.Vec3(3, 0, -10),
    ];
    lanternPositions.forEach((position, index) => {
      const lantern = new pc.Entity(`lantern-${index}`);
      lantern.setPosition(position);
      lantern.addChild(this.makePrimitive('cylinder', fenceMaterial, new pc.Vec3(0, 1.2, 0), new pc.Vec3(0.15, 2.4, 0.15), `lantern-post-${index}`));
      lantern.addChild(this.makePrimitive('sphere', lanternMaterial, new pc.Vec3(0, 2.6, 0), new pc.Vec3(0.5, 0.5, 0.5), `lantern-light-${index}`));
      this.app.root.addChild(lantern);
      // Add point light for each lantern
      const light = new pc.Entity(`lantern-glow-${index}`);
      light.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 0.85, 0.5),
        intensity: 0.6,
        range: 8,
      });
      light.setPosition(position.x, 2.8, position.z);
      this.app.root.addChild(light);
    });

    // Stars in the sky (floating bright spheres)
    const starMaterial = this.makeMaterial([1, 1, 0.9], [1, 1, 0.8]);
    starMaterial.emissiveIntensity = 3;
    starMaterial.update();
    for (let i = 0; i < 30; i += 1) {
      const seed = (i * 7919 + 104729) % 104729;
      const sx = -18 + (seed % 360) / 10;
      const sy = 8 + ((seed * 3) % 60) / 10;
      const sz = -26 + ((seed * 7) % 520) / 10;
      const size = 0.08 + ((seed * 11) % 12) / 100;
      this.app.root.addChild(this.makePrimitive('sphere', starMaterial, new pc.Vec3(sx, sy, sz), new pc.Vec3(size, size, size), `sky-star-${i}`, false));
    }

    // Research gate (arch of vines)
    const vineMaterial = this.makeMaterial([0.25, 0.45, 0.2], [0.04, 0.1, 0.04]);
    this.researchGateRoot.setLocalPosition(0, 0, -6.4);
    this.app.root.addChild(this.researchGateRoot);
    this.researchGateRoot.addChild(this.makePrimitive('cylinder', treeTrunkMaterial, new pc.Vec3(-2.2, 2.4, 0), new pc.Vec3(0.4, 4.8, 0.4), 'vine-arch-left'));
    this.researchGateRoot.addChild(this.makePrimitive('cylinder', treeTrunkMaterial, new pc.Vec3(2.2, 2.4, 0), new pc.Vec3(0.4, 4.8, 0.4), 'vine-arch-right'));
    this.researchGateRoot.addChild(this.makePrimitive('box', vineMaterial, new pc.Vec3(0, 4.85, 0), new pc.Vec3(4.7, 0.5, 0.5), 'vine-arch-top'));
    [-1.45, 0, 1.45].forEach((x, idx) => {
      this.researchGateRoot.addChild(this.makePrimitive('box', vineMaterial, new pc.Vec3(x, 2.3, 0), new pc.Vec3(1.2, 4.4, 0.24), `vine-panel-${idx}`));
    });
    this.obstacleMap.push(this.researchGateObstacle);

    // Door (magic portal at north end)
    const portalMaterial = this.makeMaterial([0.4, 0.3, 0.8], [0.6, 0.4, 1]);
    portalMaterial.emissiveIntensity = 1.8;
    portalMaterial.update();

    this.doorRoot.setLocalPosition(0, 0, FINAL_DOOR_Z);
    this.app.root.addChild(this.doorRoot);
    this.doorRoot.addChild(this.makePrimitive('box', stoneMaterial, new pc.Vec3(-4.05, 2.55, 0), new pc.Vec3(0.5, 5.1, 0.6), 'portal-frame-left'));
    this.doorRoot.addChild(this.makePrimitive('box', stoneMaterial, new pc.Vec3(4.05, 2.55, 0), new pc.Vec3(0.5, 5.1, 0.6), 'portal-frame-right'));
    this.doorRoot.addChild(this.makePrimitive('box', stoneMaterial, new pc.Vec3(0, 5.1, 0), new pc.Vec3(8.5, 0.5, 0.6), 'portal-frame-top'));
    for (let i = 0; i < 5; i += 1) {
      this.doorRoot.addChild(this.makePrimitive('box', portalMaterial, new pc.Vec3(-2.8 + i * 1.12, 2.52, 0), new pc.Vec3(1.04, 4.9, 0.38), `portal-panel-${i}`));
    }
    PUZZLE_IDS.forEach((_, index) => {
      const slotMaterial = this.makeMaterial([0.15, 0.15, 0.25], [0.03, 0.03, 0.06]);
      const slot = this.makePrimitive('sphere', slotMaterial, new pc.Vec3(-3 + index * 1.2, 6.15, 0.22), new pc.Vec3(0.38, 0.38, 0.22), `portal-slot-${index}`);
      this.doorSlots.push(slot);
      this.doorRoot.addChild(slot);
    });
    this.interactables.push({
      kind: 'door',
      entity: this.doorRoot,
      prompt: {
        title: '마법의 문',
        detail: '별빛 조각 여섯 개를 모두 모아야 마법의 문이 열린다.',
        actionLabel: '문 열기',
      },
    });

    // Puzzle stations (same IDs, different positions and decorations)
    const stage2StationSpecs: Array<{ id: PuzzleId; position: pc.Vec3 }> = [
      { id: 'colors', position: new pc.Vec3(-12, 0, 16) },
      { id: 'shapes', position: new pc.Vec3(12, 0, 16) },
      { id: 'count', position: new pc.Vec3(0, 0, 4) },
      { id: 'memory', position: new pc.Vec3(-12, 0, -16) },
      { id: 'rhythm', position: new pc.Vec3(0, 0, -18) },
      { id: 'switches', position: new pc.Vec3(12, 0, -16) },
    ];
    stage2StationSpecs.forEach(({ id, position }) => {
      const definition = STAGE_2_DEFINITIONS[id];
      const station = this.createPuzzleStation(id, definition, position);
      this.interactables.push(station);
      this.puzzleStations.set(id, station);
      this.obstacleMap.push({ x: position.x, z: position.z, radius: 1.55 });
    });

    // Hidden clue stations for Room 2
    const room2Clues: Array<{ position: pc.Vec3; title: string; body: string; prompt: PromptState }> = [
      {
        position: new pc.Vec3(-15, 1.5, 20),
        title: '나무 구멍 속 단서',
        body: '나무 구멍 안에 색 순서가 적혀 있다: 초록, 핑크, 파랑, 빨강, 노랑, 핑크, 초록.',
        prompt: { title: '나무 구멍', detail: '나무에 무언가가 숨겨져 있다.', actionLabel: '단서 보기' },
      },
      {
        position: new pc.Vec3(10, 0.3, 14),
        title: '바위 밑 조각',
        body: '바위 밑에 별자리 모양이 새겨져 있다: 별, 원, 마름모, 세모, 네모.',
        prompt: { title: '바위 밑 조각', detail: '바위 아래에 뭔가 있다.', actionLabel: '단서 보기' },
      },
      {
        position: new pc.Vec3(-3, 2.8, 4),
        title: '등불 옆 쪽지',
        body: '등불 기둥에 쪽지가 붙어 있다: 켜, 켜, 꺼, 켜, 꺼, 켜, 켜. 연결된 등불도 바뀌니 주의!',
        prompt: { title: '등불 쪽지', detail: '등불에 뭔가 붙어 있다.', actionLabel: '단서 보기' },
      },
      {
        position: new pc.Vec3(8, 0.3, -22),
        title: '풀숲 속 악보',
        body: '풀숲에 악보가 숨겨져 있다: 솔, 미, 도, 라, 솔, 미, 도.',
        prompt: { title: '풀숲 악보', detail: '나무 근처 풀숲에 종이가 보인다.', actionLabel: '단서 보기' },
      },
    ];

    const glowMaterial = this.makeMaterial([0.4, 0.8, 1], [0.3, 0.7, 1], 0.8);
    glowMaterial.emissiveIntensity = 2.5;
    glowMaterial.opacity = 0.6;
    glowMaterial.blendType = pc.BLEND_ADDITIVE;
    glowMaterial.depthWrite = false;
    glowMaterial.update();

    room2Clues.forEach((clue, index) => {
      const anchor = new pc.Entity(`room2-clue-${index}`);
      anchor.setPosition(clue.position);
      this.app.root.addChild(anchor);
      const glow = this.makePrimitive('sphere', glowMaterial, new pc.Vec3(0, 0.5, 0), new pc.Vec3(0.25, 0.25, 0.25), `room2-clue-glow-${index}`);
      anchor.addChild(glow);
      this.floatingEntities.push({ entity: glow, baseY: 0.5 });
      this.interactables.push({ kind: 'clue', entity: anchor, prompt: clue.prompt, title: clue.title, body: clue.body });
    });

    // Divider fence in middle
    this.app.root.addChild(this.makePrimitive('box', fenceMaterial, new pc.Vec3(-7.8, 1.1, -6.4), new pc.Vec3(10.4, 2.2, 0.8), 'garden-divider-west'));
    this.app.root.addChild(this.makePrimitive('box', fenceMaterial, new pc.Vec3(7.8, 1.1, -6.4), new pc.Vec3(10.4, 2.2, 0.8), 'garden-divider-east'));
    [-13.4, -9.6, -6.1, 6.1, 9.6, 13.4].forEach((x, index) => {
      this.obstacleMap.push({ x, z: -6.4, radius: index === 2 || index === 3 ? 0.8 : 1.1 });
    });

    // Fireflies (floating glowing spheres)
    const fireflyMaterial = this.makeMaterial([0.5, 1, 0.5], [0.4, 1, 0.4]);
    fireflyMaterial.emissiveIntensity = 3;
    fireflyMaterial.update();
    const yellowFireflyMaterial = this.makeMaterial([1, 1, 0.4], [1, 0.9, 0.3]);
    yellowFireflyMaterial.emissiveIntensity = 3;
    yellowFireflyMaterial.update();

    // 9 green fireflies (the answer for the count puzzle) + 5 yellow distractors
    const fireflyPositions = [
      // Green (answer = 9)
      new pc.Vec3(-12, 2.5, 18), new pc.Vec3(-8, 3, 10), new pc.Vec3(5, 2.8, 12),
      new pc.Vec3(-14, 3.2, -2), new pc.Vec3(13, 2.6, -5), new pc.Vec3(-5, 3.5, -15),
      new pc.Vec3(8, 2.9, -18), new pc.Vec3(-10, 3.1, -20), new pc.Vec3(3, 2.7, -24),
      // Yellow distractors
      new pc.Vec3(14, 3, 18), new pc.Vec3(-3, 3.3, 8), new pc.Vec3(9, 2.5, -10),
      new pc.Vec3(-13, 3.4, -14), new pc.Vec3(0, 2.8, -20),
    ];
    fireflyPositions.forEach((position, index) => {
      const isGreen = index < 9;
      const mat = isGreen ? fireflyMaterial : yellowFireflyMaterial;
      const firefly = this.makePrimitive('sphere', mat, position, new pc.Vec3(0.15, 0.15, 0.15), `firefly-${index}`, false);
      this.app.root.addChild(firefly);
      this.floatingEntities.push({ entity: firefly, baseY: position.y });
    });

    // Decorative clue artifacts (visual-only, like Room 1's wall boards)
    const clueStoneMaterial = this.makeMaterial([0.48, 0.5, 0.52], [0.05, 0.05, 0.06]);
    const colorStone = new pc.Entity('color-clue-stone');
    colorStone.setPosition(-14, 0, 14);
    colorStone.addChild(this.makePrimitive('box', clueStoneMaterial, new pc.Vec3(0, 0.15, 0), new pc.Vec3(3.6, 0.3, 1.2), 'color-stone-base', false));
    const stoneColors: Array<[number, number, number]> = [
      [0.42, 0.88, 0.61], [1, 0.55, 0.79], [0.28, 0.57, 1],
      [1, 0.44, 0.41], [1, 0.82, 0.4], [1, 0.55, 0.79], [0.42, 0.88, 0.61],
    ];
    stoneColors.forEach((c, i) => {
      colorStone.addChild(this.makePrimitive('sphere', this.makeMaterial(c, [0.08, 0.08, 0.08]),
        new pc.Vec3(-1.5 + i * 0.5, 0.42, 0), new pc.Vec3(0.28, 0.28, 0.14), `color-stone-dot-${i}`, false));
    });
    this.app.root.addChild(colorStone);

    // Switch pattern on garden divider
    const switchCluePanel = new pc.Entity('switch-clue-divider');
    switchCluePanel.setPosition(0, 2.6, -6.4);
    [true, true, false, true, false, true, true].forEach((isOn, i) => {
      switchCluePanel.addChild(this.makePrimitive('sphere',
        this.makeMaterial(isOn ? [1, 0.86, 0.43] : [0.2, 0.22, 0.28], isOn ? [0.22, 0.16, 0.04] : [0.02, 0.02, 0.02]),
        new pc.Vec3(-1.8 + i * 0.6, 0, 0.35), new pc.Vec3(0.18, 0.18, 0.1), `switch-divider-clue-${i}`, false));
    });
    this.app.root.addChild(switchCluePanel);

    // Player start
    this.playerRoot.setPosition(0, 0, PLAYER_START_Z);
    this.playerRoot.setEulerAngles(0, 180, 0);
  }

  private makeMaterial(diffuse: [number, number, number], emissive: [number, number, number], gloss = 0.45): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...diffuse);
    material.emissive = new pc.Color(...emissive);
    material.emissiveIntensity = 0.55;
    material.gloss = gloss;
    material.metalness = 0.04;
    material.useMetalness = true;
    material.update();
    return material;
  }

  private makePrimitive(
    type: string,
    material: pc.StandardMaterial,
    position: pc.Vec3,
    scale: pc.Vec3,
    name: string,
    shadows = true,
  ): pc.Entity {
    const entity = new pc.Entity(name);
    entity.addComponent('render', {
      type,
      material,
      castShadows: shadows,
      receiveShadows: true,
    });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    return entity;
  }
}
