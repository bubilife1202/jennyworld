import * as pc from 'playcanvas';
import { PUZZLE_DEFINITIONS, PUZZLE_IDS, STAGE_TITLE, type PuzzleDefinition } from './puzzles';
import { ProgressStore, countSolvedPuzzles } from './ProgressStore';
import type { ProgressState, PromptState, PuzzleId } from './types';
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

type Interactable = PuzzleStation | DoorStation;

type Obstacle = {
  x: number;
  z: number;
  radius: number;
};

export class JennyworldGame {
  private readonly app: pc.Application;
  private readonly ui: OverlayUI;
  private readonly progressStore = new ProgressStore();
  private progress: ProgressState;
  private readonly resizeHandler: () => void;
  private readonly playerRoot: pc.Entity;
  private readonly camera: pc.Entity;
  private readonly doorRoot: pc.Entity;
  private readonly interactables: Interactable[] = [];
  private readonly floatingEntities: pc.Entity[] = [];
  private readonly puzzleStations = new Map<PuzzleId, PuzzleStation>();
  private readonly obstacleMap: Obstacle[] = [];
  private readonly doorSlots: pc.Entity[] = [];
  private walkCycle = 0;
  private nearestInteractable: Interactable | null = null;
  private isDoorOpening = false;
  private doorOpenAmount = 0;
  private clearShown = false;
  private timeElapsed = 0;

  constructor(canvas: HTMLCanvasElement, ui: OverlayUI) {
    this.ui = ui;
    this.progress = this.progressStore.load();
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

    this.resizeHandler = () => {
      this.app.resizeCanvas();
    };
    window.addEventListener('resize', this.resizeHandler);

    this.buildScene();
    this.restoreStateFromProgress();
    this.updateObjective();
    this.ui.setProgress(countSolvedPuzzles(this.progress), PUZZLE_IDS.length);
    this.ui.showToast('조이스틱으로 움직이고, 가까이 가면 살펴보기를 누르세요.');

    this.app.on('update', (dt: number) => {
      this.update(dt);
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

  handleAction(): void {
    const target = this.nearestInteractable;
    if (!target) {
      return;
    }

    if (target.kind === 'door') {
      const missing = PUZZLE_IDS.length - countSolvedPuzzles(this.progress);
      if (missing > 0) {
        this.ui.showDoorLocked(missing);
        return;
      }

      if (!this.isDoorOpening && !this.progress.cleared) {
        this.isDoorOpening = true;
        this.ui.showToast('무지개 문이 열린다!');
      }
      return;
    }

    if (this.progress[target.id]) {
      return;
    }

    this.ui.openPuzzle(target.id, () => {
      this.solvePuzzle(target.id);
    });
  }

  resetStage(): void {
    this.progress = this.progressStore.reset();
    this.clearShown = false;
    this.isDoorOpening = false;
    this.doorOpenAmount = 0;
    this.timeElapsed = 0;
    this.doorRoot.setLocalPosition(0, 0, -11.45);
    this.playerRoot.setPosition(0, 0, 1.5);
    this.playerRoot.setEulerAngles(0, 180, 0);
    this.restoreStateFromProgress();
    this.updateObjective();
    this.ui.setPrompt(null);
    this.ui.setProgress(0, PUZZLE_IDS.length);
    this.ui.showToast('무지개 교실을 처음부터 다시 시작했다.');
  }

  private buildScene(): void {
    this.createLights();
    this.createRoom();
    this.createDoor();
    this.createPuzzleStations();
    this.createDecor();
    this.createPlayer();
    this.createCamera();
  }

  private createLights(): void {
    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.96, 0.86),
      intensity: 1.8,
      castShadows: true,
      shadowDistance: 30,
      shadowBias: 0.3,
      normalOffsetBias: 0.05,
      shadowResolution: 1024,
    });
    sun.setEulerAngles(45, 45, 0);
    this.app.root.addChild(sun);

    const fill = new pc.Entity('fill');
    fill.addComponent('light', {
      type: 'omni',
      color: new pc.Color(0.72, 0.85, 1),
      intensity: 0.9,
      range: 24,
    });
    fill.setPosition(0, 8, 2);
    this.app.root.addChild(fill);
  }

  private createRoom(): void {
    const floorMaterial = this.makeMaterial([0.98, 0.92, 0.72], [0.13, 0.1, 0.04]);
    const wallMaterial = this.makeMaterial([0.88, 0.95, 1], [0.02, 0.04, 0.09]);
    const trimMaterial = this.makeMaterial([1, 0.8, 0.43], [0.12, 0.08, 0]);
    const cloudMaterial = this.makeMaterial([1, 1, 1], [0.15, 0.15, 0.15]);

    this.app.root.addChild(this.makePrimitive('box', floorMaterial, new pc.Vec3(0, -0.5, 0), new pc.Vec3(26, 1, 26), 'floor'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(-12.7, 3, 0), new pc.Vec3(1, 6, 26), 'wall-west'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(12.7, 3, 0), new pc.Vec3(1, 6, 26), 'wall-east'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(-8, 3, -12.7), new pc.Vec3(10, 6, 1), 'wall-north-left'));
    this.app.root.addChild(this.makePrimitive('box', wallMaterial, new pc.Vec3(8, 3, -12.7), new pc.Vec3(10, 6, 1), 'wall-north-right'));
    this.app.root.addChild(this.makePrimitive('box', trimMaterial, new pc.Vec3(0, 0.15, 0), new pc.Vec3(26, 0.3, 26), 'trim-bottom'));
    this.app.root.addChild(this.makePrimitive('box', trimMaterial, new pc.Vec3(0, 5.2, -12.7), new pc.Vec3(6.3, 1.6, 1), 'door-beam'));

    const clouds = [
      new pc.Vec3(-8.8, 4.7, 10.9),
      new pc.Vec3(0, 4.4, 11.1),
      new pc.Vec3(8.8, 4.7, 10.9),
    ];
    clouds.forEach((position, index) => {
      const cloud = this.makePrimitive('sphere', cloudMaterial, position, new pc.Vec3(1.8, 0.9, 0.45), `cloud-${index}`);
      this.app.root.addChild(cloud);
    });
  }

  private createDoor(): void {
    this.doorRoot.setLocalPosition(0, 0, -11.45);
    this.app.root.addChild(this.doorRoot);

    const frameMaterial = this.makeMaterial([0.34, 0.37, 0.52], [0.06, 0.07, 0.1]);
    const colors: Array<[number, number, number]> = [
      [1, 0.47, 0.42],
      [1, 0.73, 0.33],
      [1, 0.91, 0.46],
      [0.43, 0.84, 0.99],
      [0.52, 0.95, 0.8],
    ];

    this.doorRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(-3.1, 2.55, 0), new pc.Vec3(0.35, 5.1, 0.6), 'door-frame-left'));
    this.doorRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(3.1, 2.55, 0), new pc.Vec3(0.35, 5.1, 0.6), 'door-frame-right'));
    this.doorRoot.addChild(this.makePrimitive('box', frameMaterial, new pc.Vec3(0, 5.1, 0), new pc.Vec3(6.6, 0.35, 0.6), 'door-frame-top'));

    colors.forEach((color, index) => {
      const panelMaterial = this.makeMaterial(color, [0.06, 0.06, 0.06]);
      const panel = this.makePrimitive(
        'box',
        panelMaterial,
        new pc.Vec3(-1.96 + index * 0.98, 2.52, 0),
        new pc.Vec3(0.92, 4.9, 0.38),
        `door-panel-${index}`,
      );
      this.doorRoot.addChild(panel);
    });

    PUZZLE_IDS.forEach((_, index) => {
      const slotMaterial = this.makeMaterial([0.23, 0.26, 0.35], [0.03, 0.03, 0.04]);
      const slot = this.makePrimitive(
        'sphere',
        slotMaterial,
        new pc.Vec3(-1.8 + index * 1.2, 6.15, 0.22),
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
        detail: '별 조각이 모두 모이면 문을 열 수 있다.',
        actionLabel: '문 열기',
      },
    });
  }

  private createPuzzleStations(): void {
    const stationSpecs: Array<{ id: PuzzleId; position: pc.Vec3 }> = [
      { id: 'colors', position: new pc.Vec3(-8.2, 0, -6.6) },
      { id: 'shapes', position: new pc.Vec3(8.2, 0, -6.6) },
      { id: 'count', position: new pc.Vec3(-8.2, 0, 7.2) },
      { id: 'memory', position: new pc.Vec3(8.2, 0, 7.2) },
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
    this.floatingEntities.push(orb);

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

    if (id === 'colors') {
      root.addChild(this.makePrimitive('box', this.makeMaterial([1, 0.44, 0.41], [0.1, 0.03, 0.03]), new pc.Vec3(-0.72, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'red-cube'));
      root.addChild(this.makePrimitive('box', blueMaterial, new pc.Vec3(0, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'blue-cube'));
      root.addChild(this.makePrimitive('box', yellowMaterial, new pc.Vec3(0.72, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'yellow-cube'));
      return;
    }

    if (id === 'shapes') {
      root.addChild(this.makePrimitive('sphere', blueMaterial, new pc.Vec3(-0.72, 2.95, 0), new pc.Vec3(0.32, 0.32, 0.32), 'shape-sphere'));
      root.addChild(this.makePrimitive('cone', pinkMaterial, new pc.Vec3(0, 2.95, 0), new pc.Vec3(0.3, 0.46, 0.3), 'shape-cone'));
      root.addChild(this.makePrimitive('box', whiteMaterial, new pc.Vec3(0.72, 2.95, 0), new pc.Vec3(0.34, 0.34, 0.34), 'shape-box'));
      return;
    }

    if (id === 'count') {
      for (let index = 0; index < 3; index += 1) {
        root.addChild(this.makePrimitive('cylinder', yellowMaterial, new pc.Vec3(-0.48 + index * 0.48, 3.02, 0.18), new pc.Vec3(0.09, 0.42, 0.09), `pencil-front-${index}`));
        root.addChild(this.makePrimitive('cylinder', yellowMaterial, new pc.Vec3(-0.48 + index * 0.48, 3.02, -0.18), new pc.Vec3(0.09, 0.42, 0.09), `pencil-back-${index}`));
      }
      return;
    }

    root.addChild(this.makePrimitive('box', pinkMaterial, new pc.Vec3(-0.72, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-pink'));
    root.addChild(this.makePrimitive('box', blueMaterial, new pc.Vec3(0, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-blue'));
    root.addChild(this.makePrimitive('box', yellowMaterial, new pc.Vec3(0.72, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-yellow'));
  }

  private createDecor(): void {
    const deskMaterial = this.makeMaterial([0.78, 0.57, 0.35], [0.09, 0.06, 0.03]);
    const legMaterial = this.makeMaterial([0.54, 0.67, 0.94], [0.03, 0.05, 0.09]);
    const boardMaterial = this.makeMaterial([0.35, 0.71, 0.59], [0.05, 0.1, 0.08]);
    const shelfMaterial = this.makeMaterial([0.99, 0.92, 0.79], [0.08, 0.07, 0.05]);
    const bookMaterials = [
      this.makeMaterial([1, 0.53, 0.44], [0.05, 0.03, 0.03]),
      this.makeMaterial([0.48, 0.77, 1], [0.03, 0.05, 0.09]),
      this.makeMaterial([1, 0.82, 0.4], [0.08, 0.05, 0.01]),
    ];

    const board = this.makePrimitive('box', boardMaterial, new pc.Vec3(0, 3.2, -12.15), new pc.Vec3(8, 2.4, 0.16), 'chalk-board');
    this.app.root.addChild(board);

    const deskPositions = [new pc.Vec3(-3.6, 0, -0.6), new pc.Vec3(3.6, 0, -0.6), new pc.Vec3(0, 0, 4.2)];
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
    shelf.setPosition(10.2, 0, 1.8);
    shelf.addChild(this.makePrimitive('box', shelfMaterial, new pc.Vec3(0, 1.8, 0), new pc.Vec3(1.2, 3.5, 4.2), 'shelf-frame'));
    [-1.3, 0, 1.3].forEach((offset, index) => {
      shelf.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 0.8 + index, offset * 0.1), new pc.Vec3(1.22, 0.12, 3.9), `shelf-layer-${index}`));
    });
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const material = bookMaterials[(row + column) % bookMaterials.length];
        shelf.addChild(
          this.makePrimitive(
            'box',
            material,
            new pc.Vec3(-0.26 + column * 0.17, 1.15 + row, -1.1 + column * 0.7),
            new pc.Vec3(0.12, 0.55, 0.42),
            `book-${row}-${column}`,
          ),
        );
      }
    }
    this.app.root.addChild(shelf);

    const countingDesk = new pc.Entity('counting-desk');
    countingDesk.setPosition(-5.2, 0, 9.5);
    countingDesk.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 1.08, 0), new pc.Vec3(3.4, 0.2, 1.8), 'count-desk-top'));
    const pencilMaterial = this.makeMaterial([1, 0.83, 0.38], [0.08, 0.05, 0.01]);
    for (let index = 0; index < 6; index += 1) {
      const pencil = this.makePrimitive(
        'cylinder',
        pencilMaterial,
        new pc.Vec3(-1 + index * 0.4, 1.43, 0),
        new pc.Vec3(0.07, 0.42, 0.07),
        `desk-pencil-${index}`,
      );
      pencil.setEulerAngles(90, 0, 20);
      countingDesk.addChild(pencil);
    }
    this.app.root.addChild(countingDesk);
    this.obstacleMap.push({ x: -5.2, z: 9.5, radius: 1.4 });
  }

  private createPlayer(): void {
    this.playerRoot.setPosition(0, 0, 1.5);
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
    this.camera.addComponent('camera', {
      clearColor: new pc.Color(0.86, 0.96, 1),
      fov: 56,
      farClip: 80,
      nearClip: 0.2,
    });
    this.camera.setPosition(0, 11.5, 22);
    this.camera.lookAt(0, 1.8, 0);
    this.app.root.addChild(this.camera);
  }

  private restoreStateFromProgress(): void {
    this.puzzleStations.forEach((station, id) => {
      const solved = this.progress[id];
      station.highlightMaterial.diffuse = solved ? station.solvedColor : station.baseColor;
      station.highlightMaterial.emissive = solved ? new pc.Color(0.26, 0.22, 0.02) : new pc.Color(0.03, 0.03, 0.05);
      station.highlightMaterial.emissiveIntensity = solved ? 1.2 : 0.5;
      station.highlightMaterial.update();

      station.orbMaterial.diffuse = solved ? new pc.Color(1, 0.82, 0.33) : new pc.Color(0.27, 0.31, 0.39);
      station.orbMaterial.emissive = solved ? new pc.Color(0.8, 0.62, 0.18) : new pc.Color(0.08, 0.1, 0.12);
      station.orbMaterial.emissiveIntensity = solved ? 1.9 : 1.4;
      station.orbMaterial.update();
      station.orb.enabled = !solved;
    });

    PUZZLE_IDS.forEach((puzzleId, index) => {
      const slotEntity = this.doorSlots[index];
      const slotMaterial = slotEntity.render?.meshInstances[0]?.material as pc.StandardMaterial | undefined;
      if (!slotMaterial) {
        return;
      }

      const solved = this.progress[puzzleId];
      slotMaterial.diffuse = solved ? new pc.Color(1, 0.82, 0.33) : new pc.Color(0.23, 0.26, 0.35);
      slotMaterial.emissive = solved ? new pc.Color(0.88, 0.66, 0.16) : new pc.Color(0.03, 0.03, 0.04);
      slotMaterial.emissiveIntensity = solved ? 2 : 0.35;
      slotMaterial.update();
    });

    if (this.progress.cleared) {
      this.doorOpenAmount = 1;
      this.doorRoot.setLocalPosition(0, 4.2, -11.45);
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
    this.progressStore.save(this.progress);
    this.restoreStateFromProgress();

    const solvedCount = countSolvedPuzzles(this.progress);
    this.ui.setProgress(solvedCount, PUZZLE_IDS.length);
    this.updateObjective();

    if (solvedCount === PUZZLE_IDS.length) {
      this.ui.showToast('별 조각을 모두 모았다. 무지개 문으로 가자!');
    } else {
      this.ui.showToast('별 조각을 찾았다!');
    }
  }

  private update(dt: number): void {
    this.timeElapsed += dt;
    this.animateFloaters(dt);
    this.animateDoor(dt);

    if (!this.ui.isBlockingGame()) {
      this.updatePlayerMovement(dt);
      this.updateNearestInteractable();
    } else {
      this.ui.setPrompt(null);
      this.nearestInteractable = null;
    }

    this.updateCamera(dt);
    this.animateAvatar(dt);
  }

  private updatePlayerMovement(dt: number): void {
    const keyboard = this.app.keyboard;
    const joystick = this.ui.getMoveVector();
    const moveX =
      (keyboard?.isPressed(pc.KEY_D) ? 1 : 0) -
      (keyboard?.isPressed(pc.KEY_A) ? 1 : 0) +
      joystick.x;
    const moveZ =
      (keyboard?.isPressed(pc.KEY_S) ? 1 : 0) -
      (keyboard?.isPressed(pc.KEY_W) ? 1 : 0) +
      joystick.y;

    const input = new pc.Vec3(moveX, 0, moveZ);
    if (input.lengthSq() > 1) {
      input.normalize();
    }

    if (input.lengthSq() <= 0.0001) {
      return;
    }

    const position = this.playerRoot.getPosition().clone();
    const speed = 5.9;
    const candidate = new pc.Vec3(position.x + input.x * speed * dt, 0, position.z + input.z * speed * dt);

    candidate.x = pc.math.clamp(candidate.x, -10.7, 10.7);
    candidate.z = pc.math.clamp(candidate.z, -10.9, 10.7);

    this.obstacleMap.forEach((obstacle) => {
      const deltaX = candidate.x - obstacle.x;
      const deltaZ = candidate.z - obstacle.z;
      const distance = Math.hypot(deltaX, deltaZ);
      const minDistance = obstacle.radius + 0.8;
      if (distance > 0 && distance < minDistance) {
        const push = minDistance - distance;
        candidate.x += (deltaX / distance) * push;
        candidate.z += (deltaZ / distance) * push;
      }
    });

    this.playerRoot.setPosition(candidate.x, 0, candidate.z);
    const targetYaw = Math.atan2(input.x, input.z) * pc.math.RAD_TO_DEG;
    const currentYaw = this.playerRoot.getEulerAngles().y;
    const nextYaw = pc.math.lerpAngle(currentYaw, targetYaw, 0.18);
    this.playerRoot.setEulerAngles(0, nextYaw, 0);
    this.walkCycle += dt * 10;
  }

  private updateNearestInteractable(): void {
    const playerPosition = this.playerRoot.getPosition();
    let nearest: Interactable | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const interactable of this.interactables) {
      if (interactable.kind === 'puzzle' && this.progress[interactable.id]) {
        continue;
      }

      const worldPosition = interactable.entity.getPosition();
      const distance = Math.hypot(worldPosition.x - playerPosition.x, worldPosition.z - playerPosition.z);
      if (distance < 3.3 && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    this.nearestInteractable = nearest;
    if (nearest) {
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
    const followX = isPortrait ? 0.72 : 0.16;
    const followZ = isPortrait ? 0.16 : 0;
    const cameraHeight = isPortrait ? 12.8 : 11.5;
    const cameraDistance = isPortrait ? 24.5 : 22;
    const desiredPosition = new pc.Vec3(
      pc.math.clamp(playerPosition.x * followX, -6.2, 6.2),
      cameraHeight,
      cameraDistance + playerPosition.z * followZ,
    );
    const current = this.camera.getPosition();
    const blend = 1 - Math.exp(-dt * 5.2);
    const next = new pc.Vec3(
      pc.math.lerp(current.x, desiredPosition.x, blend),
      pc.math.lerp(current.y, desiredPosition.y, blend),
      pc.math.lerp(current.z, desiredPosition.z, blend),
    );
    this.camera.setPosition(next);
    this.camera.lookAt(
      playerPosition.x * (isPortrait ? 0.72 : 0.08),
      1.8,
      isPortrait ? playerPosition.z * 0.22 : 0,
    );
  }

  private animateAvatar(dt: number): void {
    const moving = !this.ui.isBlockingGame() && this.walkCycle > 0.05;
    const swing = moving ? Math.sin(this.walkCycle) * 18 : 0;
    this.playerRoot.findByName('player-arm-left')?.setLocalEulerAngles(swing, 0, 0);
    this.playerRoot.findByName('player-arm-right')?.setLocalEulerAngles(-swing, 0, 0);
    this.playerRoot.findByName('player-leg-left')?.setLocalEulerAngles(-swing, 0, 0);
    this.playerRoot.findByName('player-leg-right')?.setLocalEulerAngles(swing, 0, 0);

    if (!moving) {
      this.walkCycle = Math.max(0, this.walkCycle - dt * 4);
    }
  }

  private animateFloaters(dt: number): void {
    this.floatingEntities.forEach((entity, index) => {
      const baseX = entity.getLocalPosition().x;
      const baseZ = entity.getLocalPosition().z;
      entity.setLocalPosition(baseX, 3.45 + Math.sin(this.timeElapsed * 2.2 + index) * 0.12, baseZ);
      entity.rotateLocal(0, dt * 42, 0);
    });
  }

  private animateDoor(dt: number): void {
    if (!this.isDoorOpening && !this.progress.cleared) {
      return;
    }

    this.doorOpenAmount = Math.min(1, this.doorOpenAmount + dt * 0.7);
    const eased = pc.math.smoothstep(0, 1, this.doorOpenAmount);
    this.doorRoot.setLocalPosition(0, eased * 4.2, -11.45);

    if (this.doorOpenAmount >= 1 && !this.clearShown) {
      this.clearShown = true;
      this.progress.cleared = true;
      this.progressStore.save(this.progress);
      this.updateObjective();
      this.ui.showClear();
    }
  }

  private updateObjective(): void {
    const solvedCount = countSolvedPuzzles(this.progress);

    if (this.progress.cleared) {
      this.ui.setObjective(`${STAGE_TITLE} 클리어`, '같은 방을 다시 하거나 다음 스테이지를 확장할 준비가 됐다.');
      return;
    }

    if (solvedCount === PUZZLE_IDS.length) {
      this.ui.setObjective('무지개 문으로 가자', '별 조각을 모두 모았다. 앞쪽 무지개 문에 다가가 문을 열자.');
      return;
    }

    this.ui.setObjective('별 조각을 모으자', `교실 네 곳의 퍼즐 중 ${solvedCount}개를 풀었다. 남은 별 조각 ${PUZZLE_IDS.length - solvedCount}개를 찾자.`);
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
  ): pc.Entity {
    const entity = new pc.Entity(name);
    entity.addComponent('render', {
      type,
      material,
      castShadows: true,
      receiveShadows: true,
    });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    return entity;
  }
}
