import * as pc from 'playcanvas';
import { PROJECTION_ORTHOGRAPHIC } from 'playcanvas';
import { PUZZLE_DEFINITIONS, PUZZLE_IDS, STAGE_TITLE, type PuzzleDefinition } from './puzzles';
import { ProgressStore, countSolvedPuzzles } from './ProgressStore';
import type { ProgressState, PuzzleId } from './types';
import { OverlayUI } from './ui';

type PuzzleStation = {
  id: PuzzleId;
  entity: pc.Entity;
  orb: pc.Entity;
  orbMaterial: pc.StandardMaterial;
  baseMaterial: pc.StandardMaterial;
  baseColor: pc.Color;
  solvedColor: pc.Color;
};

export class JennyworldGame {
  private readonly app: pc.Application;
  private readonly ui: OverlayUI;
  private readonly progressStore = new ProgressStore();
  private progress: ProgressState;
  private readonly resizeHandler: () => void;
  private readonly camera: pc.Entity;
  private readonly doorRoot: pc.Entity;
  private readonly floatingEntities: pc.Entity[] = [];
  private readonly puzzleStations = new Map<PuzzleId, PuzzleStation>();
  private readonly doorSlots: pc.Entity[] = [];
  private readonly avatarRoot: pc.Entity;
  private timeElapsed = 0;
  private isDoorOpening = false;
  private doorOpenAmount = 0;
  private clearShown = false;

  constructor(canvas: HTMLCanvasElement, ui: OverlayUI) {
    this.ui = ui;
    this.progress = this.progressStore.load();
    this.clearShown = this.progress.cleared;

    this.app = new pc.Application(canvas, {
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
    this.app.scene.ambientLight = new pc.Color(0.76, 0.79, 0.87);
    this.app.start();

    this.camera = new pc.Entity('camera');
    this.doorRoot = new pc.Entity('door-root');
    this.avatarRoot = new pc.Entity('avatar-root');

    this.resizeHandler = () => {
      this.app.resizeCanvas();
      this.updateCameraFraming();
    };
    window.addEventListener('resize', this.resizeHandler);

    this.buildScene();
    this.restoreStateFromProgress();
    this.syncUi();

    this.app.on('update', (dt: number) => {
      this.update(dt);
    });
  }

  focus(): void {
    this.ui.focusCanvas();
  }

  destroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.app.destroy();
  }

  openPuzzle(puzzleId: PuzzleId): void {
    if (this.progress[puzzleId]) {
      return;
    }

    this.ui.openPuzzle(puzzleId, () => {
      this.solvePuzzle(puzzleId);
    });
  }

  tryOpenDoor(): void {
    const missing = PUZZLE_IDS.length - countSolvedPuzzles(this.progress);
    if (missing > 0) {
      this.ui.showDoorLocked(missing);
      return;
    }

    if (this.progress.cleared || this.isDoorOpening) {
      return;
    }

    this.isDoorOpening = true;
    this.ui.showToast('무지개 문이 열리고 있어.');
  }

  resetStage(): void {
    this.progress = this.progressStore.reset();
    this.clearShown = false;
    this.isDoorOpening = false;
    this.doorOpenAmount = 0;
    this.timeElapsed = 0;
    this.ui.hideClear();
    this.ui.closeModal();
    this.restoreStateFromProgress();
    this.syncUi();
    this.ui.showToast('처음부터 다시 시작했어.');
  }

  private buildScene(): void {
    this.createLights();
    this.createCamera();
    this.createRoom();
    this.createDoor();
    this.createPuzzleStations();
    this.createDecor();
    this.createAvatar();
  }

  private createLights(): void {
    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.97, 0.9),
      intensity: 1.7,
      castShadows: true,
      shadowDistance: 40,
      shadowResolution: 1024,
      normalOffsetBias: 0.05,
    });
    sun.setEulerAngles(48, 35, 0);
    this.app.root.addChild(sun);

    const fill = new pc.Entity('fill');
    fill.addComponent('light', {
      type: 'omni',
      color: new pc.Color(0.72, 0.86, 1),
      intensity: 1.15,
      range: 30,
    });
    fill.setPosition(0, 9, 5);
    this.app.root.addChild(fill);
  }

  private createCamera(): void {
    this.camera.addComponent('camera', {
      clearColor: new pc.Color(0.82, 0.93, 1),
      farClip: 80,
      nearClip: 0.2,
      projection: PROJECTION_ORTHOGRAPHIC,
      orthoHeight: 10,
    });
    this.camera.setPosition(0, 13, 18);
    this.camera.lookAt(0, 2.8, 0);
    this.app.root.addChild(this.camera);
    this.updateCameraFraming();
  }

  private updateCameraFraming(): void {
    const cameraComponent = this.camera.camera;
    if (!cameraComponent) {
      return;
    }

    const canvas = this.app.graphicsDevice.canvas as HTMLCanvasElement;
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    cameraComponent.orthoHeight = aspect < 0.7 ? 18 : aspect < 1 ? 15 : 11.5;
  }

  private createRoom(): void {
    const floorMaterial = this.makeMaterial([0.98, 0.91, 0.7], [0.1, 0.08, 0.03]);
    const wallMaterial = this.makeMaterial([0.88, 0.95, 1], [0.02, 0.04, 0.08]);
    const trimMaterial = this.makeMaterial([1, 0.79, 0.42], [0.11, 0.08, 0.02]);
    const cloudMaterial = this.makeMaterial([1, 1, 1], [0.14, 0.14, 0.14]);

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

    const frameMaterial = this.makeMaterial([0.34, 0.37, 0.52], [0.05, 0.06, 0.08]);
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
  }

  private createPuzzleStations(): void {
    const stationSpecs: Array<{ id: PuzzleId; position: pc.Vec3 }> = [
      { id: 'colors', position: new pc.Vec3(-8.4, 0, -5.8) },
      { id: 'shapes', position: new pc.Vec3(8.4, 0, -5.8) },
      { id: 'count', position: new pc.Vec3(-8.2, 0, 6.9) },
      { id: 'memory', position: new pc.Vec3(8.2, 0, 6.9) },
    ];

    stationSpecs.forEach(({ id, position }) => {
      const definition = PUZZLE_DEFINITIONS[id];
      const station = this.createPuzzleStation(id, definition, position);
      this.puzzleStations.set(id, station);
    });
  }

  private createPuzzleStation(id: PuzzleId, definition: PuzzleDefinition, position: pc.Vec3): PuzzleStation {
    const root = new pc.Entity(`${id}-station`);
    root.setPosition(position);
    this.app.root.addChild(root);

    const baseColor = new pc.Color(...definition.pedestalColor);
    const solvedColor = new pc.Color(1, 0.84, 0.36);
    const baseMaterial = this.makeMaterial(definition.pedestalColor, [0.06, 0.06, 0.09]);
    const plateMaterial = this.makeMaterial([1, 1, 1], [0.2, 0.2, 0.2]);
    const orbMaterial = this.makeMaterial([0.27, 0.31, 0.39], [0.1, 0.12, 0.14]);
    orbMaterial.emissiveIntensity = 1.4;
    orbMaterial.update();

    root.addChild(this.makePrimitive('box', baseMaterial, new pc.Vec3(0, 1.15, 0), new pc.Vec3(2.3, 2.3, 2.3), `${id}-pedestal`));
    root.addChild(this.makePrimitive('box', plateMaterial, new pc.Vec3(0, 2.45, 0), new pc.Vec3(1.95, 0.18, 1.95), `${id}-plate`));
    const orb = this.makePrimitive('sphere', orbMaterial, new pc.Vec3(0, 3.45, 0), new pc.Vec3(0.72, 0.72, 0.72), `${id}-orb`);
    root.addChild(orb);
    this.floatingEntities.push(orb);

    this.decorateStation(id, root);

    return {
      id,
      entity: root,
      orb,
      orbMaterial,
      baseMaterial,
      baseColor,
      solvedColor,
    };
  }

  private decorateStation(id: PuzzleId, root: pc.Entity): void {
    const white = this.makeMaterial([1, 1, 1], [0.12, 0.12, 0.12]);
    const yellow = this.makeMaterial([1, 0.84, 0.37], [0.11, 0.09, 0.02]);
    const blue = this.makeMaterial([0.41, 0.74, 1], [0.03, 0.06, 0.12]);
    const pink = this.makeMaterial([1, 0.66, 0.84], [0.12, 0.03, 0.08]);
    const red = this.makeMaterial([1, 0.44, 0.41], [0.08, 0.03, 0.03]);

    if (id === 'colors') {
      root.addChild(this.makePrimitive('box', red, new pc.Vec3(-0.72, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'red-cube'));
      root.addChild(this.makePrimitive('box', blue, new pc.Vec3(0, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'blue-cube'));
      root.addChild(this.makePrimitive('box', yellow, new pc.Vec3(0.72, 2.9, 0), new pc.Vec3(0.34, 0.34, 0.34), 'yellow-cube'));
      return;
    }

    if (id === 'shapes') {
      root.addChild(this.makePrimitive('sphere', blue, new pc.Vec3(-0.72, 2.95, 0), new pc.Vec3(0.32, 0.32, 0.32), 'shape-sphere'));
      root.addChild(this.makePrimitive('cone', pink, new pc.Vec3(0, 2.95, 0), new pc.Vec3(0.3, 0.46, 0.3), 'shape-cone'));
      root.addChild(this.makePrimitive('box', white, new pc.Vec3(0.72, 2.95, 0), new pc.Vec3(0.34, 0.34, 0.34), 'shape-box'));
      return;
    }

    if (id === 'count') {
      for (let index = 0; index < 3; index += 1) {
        root.addChild(this.makePrimitive('cylinder', yellow, new pc.Vec3(-0.48 + index * 0.48, 3.02, 0.18), new pc.Vec3(0.09, 0.42, 0.09), `pencil-front-${index}`));
        root.addChild(this.makePrimitive('cylinder', yellow, new pc.Vec3(-0.48 + index * 0.48, 3.02, -0.18), new pc.Vec3(0.09, 0.42, 0.09), `pencil-back-${index}`));
      }
      return;
    }

    root.addChild(this.makePrimitive('box', pink, new pc.Vec3(-0.72, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-pink'));
    root.addChild(this.makePrimitive('box', blue, new pc.Vec3(0, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-blue'));
    root.addChild(this.makePrimitive('box', yellow, new pc.Vec3(0.72, 2.95, 0), new pc.Vec3(0.32, 0.08, 0.32), 'memory-yellow'));
  }

  private createDecor(): void {
    const deskMaterial = this.makeMaterial([0.78, 0.57, 0.35], [0.09, 0.06, 0.03]);
    const legMaterial = this.makeMaterial([0.54, 0.67, 0.94], [0.03, 0.05, 0.09]);
    const boardMaterial = this.makeMaterial([0.35, 0.71, 0.59], [0.05, 0.1, 0.08]);
    const shelfMaterial = this.makeMaterial([0.99, 0.92, 0.79], [0.08, 0.07, 0.05]);
    const bookColors: Array<[number, number, number]> = [
      [1, 0.53, 0.44],
      [0.48, 0.77, 1],
      [1, 0.82, 0.4],
    ];

    this.app.root.addChild(this.makePrimitive('box', boardMaterial, new pc.Vec3(0, 3.2, -12.15), new pc.Vec3(8, 2.4, 0.16), 'chalk-board'));

    const deskPositions = [new pc.Vec3(-3.6, 0, -0.8), new pc.Vec3(3.6, 0, -0.8), new pc.Vec3(0, 0, 3.6)];
    deskPositions.forEach((position, index) => {
      const desk = new pc.Entity(`desk-${index}`);
      desk.setPosition(position);
      desk.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 1.2, 0), new pc.Vec3(3.2, 0.25, 2), 'desk-top'));
      [
        new pc.Vec3(-1.2, 0.55, -0.7),
        new pc.Vec3(1.2, 0.55, -0.7),
        new pc.Vec3(-1.2, 0.55, 0.7),
        new pc.Vec3(1.2, 0.55, 0.7),
      ].forEach((offset, legIndex) => {
        desk.addChild(this.makePrimitive('box', legMaterial, offset, new pc.Vec3(0.22, 1.1, 0.22), `desk-leg-${legIndex}`));
      });
      this.app.root.addChild(desk);
    });

    const shelf = new pc.Entity('book-shelf');
    shelf.setPosition(10.2, 0, 1.8);
    shelf.addChild(this.makePrimitive('box', shelfMaterial, new pc.Vec3(0, 1.8, 0), new pc.Vec3(1.2, 3.5, 4.2), 'shelf-frame'));
    [-1.3, 0, 1.3].forEach((offset, index) => {
      shelf.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 0.8 + index, offset * 0.1), new pc.Vec3(1.22, 0.12, 3.9), `shelf-layer-${index}`));
    });
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const color = bookColors[(row + column) % bookColors.length];
        shelf.addChild(
          this.makePrimitive(
            'box',
            this.makeMaterial(color, [0.04, 0.04, 0.05]),
            new pc.Vec3(-0.26 + column * 0.17, 1.15 + row, -1.1 + column * 0.7),
            new pc.Vec3(0.12, 0.55, 0.42),
            `book-${row}-${column}`,
          ),
        );
      }
    }
    this.app.root.addChild(shelf);

    const pencilDesk = new pc.Entity('pencil-desk');
    pencilDesk.setPosition(-5.2, 0, 8.8);
    pencilDesk.addChild(this.makePrimitive('box', deskMaterial, new pc.Vec3(0, 1.08, 0), new pc.Vec3(3.4, 0.2, 1.8), 'count-desk-top'));
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
      pencilDesk.addChild(pencil);
    }
    this.app.root.addChild(pencilDesk);
  }

  private createAvatar(): void {
    this.avatarRoot.setPosition(0, 0, 3.8);
    this.app.root.addChild(this.avatarRoot);

    const skin = this.makeMaterial([1, 0.87, 0.67], [0.08, 0.06, 0.03]);
    const shirt = this.makeMaterial([0.39, 0.74, 1], [0.04, 0.07, 0.11]);
    const denim = this.makeMaterial([0.25, 0.42, 0.84], [0.03, 0.05, 0.09]);
    const hair = this.makeMaterial([0.42, 0.23, 0.1], [0.04, 0.02, 0.01]);
    const eye = this.makeMaterial([0.08, 0.1, 0.18], [0.01, 0.01, 0.02]);

    const parts = [
      this.makePrimitive('box', shirt, new pc.Vec3(0, 2.2, 0), new pc.Vec3(0.95, 1.2, 0.56), 'avatar-body'),
      this.makePrimitive('box', denim, new pc.Vec3(0, 1.45, 0.01), new pc.Vec3(0.98, 0.98, 0.6), 'avatar-overall'),
      this.makePrimitive('box', skin, new pc.Vec3(0, 3.3, 0), new pc.Vec3(0.84, 0.86, 0.78), 'avatar-head'),
      this.makePrimitive('box', hair, new pc.Vec3(0, 3.6, 0.12), new pc.Vec3(0.88, 0.32, 0.7), 'avatar-hair'),
      this.makePrimitive('box', eye, new pc.Vec3(-0.14, 3.3, 0.41), new pc.Vec3(0.08, 0.08, 0.02), 'avatar-eye-left'),
      this.makePrimitive('box', eye, new pc.Vec3(0.14, 3.3, 0.41), new pc.Vec3(0.08, 0.08, 0.02), 'avatar-eye-right'),
      this.makePrimitive('box', skin, new pc.Vec3(-0.74, 2.06, 0), new pc.Vec3(0.22, 1.12, 0.22), 'avatar-arm-left'),
      this.makePrimitive('box', skin, new pc.Vec3(0.74, 2.06, 0), new pc.Vec3(0.22, 1.12, 0.22), 'avatar-arm-right'),
      this.makePrimitive('box', denim, new pc.Vec3(-0.23, 0.76, 0), new pc.Vec3(0.3, 1.22, 0.3), 'avatar-leg-left'),
      this.makePrimitive('box', denim, new pc.Vec3(0.23, 0.76, 0), new pc.Vec3(0.3, 1.22, 0.3), 'avatar-leg-right'),
    ];

    parts.forEach((part) => {
      this.avatarRoot.addChild(part);
    });
  }

  private restoreStateFromProgress(): void {
    this.puzzleStations.forEach((station, id) => {
      const solved = this.progress[id];
      station.baseMaterial.diffuse = solved ? station.solvedColor : station.baseColor;
      station.baseMaterial.emissive = solved ? new pc.Color(0.22, 0.18, 0.02) : new pc.Color(0.03, 0.03, 0.05);
      station.baseMaterial.emissiveIntensity = solved ? 1.2 : 0.55;
      station.baseMaterial.update();

      station.orbMaterial.diffuse = solved ? new pc.Color(1, 0.82, 0.33) : new pc.Color(0.27, 0.31, 0.39);
      station.orbMaterial.emissive = solved ? new pc.Color(0.8, 0.62, 0.18) : new pc.Color(0.1, 0.12, 0.14);
      station.orbMaterial.emissiveIntensity = solved ? 1.9 : 1.4;
      station.orbMaterial.update();
      station.orb.enabled = !solved;
    });

    PUZZLE_IDS.forEach((puzzleId, index) => {
      const slotMaterial = this.doorSlots[index].render?.meshInstances[0]?.material as pc.StandardMaterial | undefined;
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
    } else {
      this.doorRoot.setLocalPosition(0, 0, -11.45);
    }
  }

  private syncUi(): void {
    const solvedCount = countSolvedPuzzles(this.progress);
    this.ui.setProgress(solvedCount, PUZZLE_IDS.length);
    this.ui.setStageState(this.progress);

    if (this.progress.cleared) {
      this.ui.setObjective(`${STAGE_TITLE} 클리어`, '다시 시작하거나 다음 스테이지를 이어서 만들 수 있다.');
      return;
    }

    if (solvedCount === PUZZLE_IDS.length) {
      this.ui.setObjective('무지개 문 열기', '이제 아래의 무지개 문 버튼을 눌러 스테이지를 클리어하자.');
      return;
    }

    this.ui.setObjective('별 조각을 모으자', `${solvedCount}개의 퍼즐을 풀었다. 아래 남은 퍼즐 버튼을 눌러 계속 진행하자.`);
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
    this.syncUi();
    this.ui.showToast('별 조각을 찾았다!');

    if (countSolvedPuzzles(this.progress) === PUZZLE_IDS.length) {
      this.ui.showToast('별 조각이 다 모였다. 이제 무지개 문을 열자.');
    }
  }

  private update(dt: number): void {
    this.timeElapsed += dt;
    this.animateFloaters();
    this.animateDoor(dt);
  }

  private animateFloaters(): void {
    this.floatingEntities.forEach((entity, index) => {
      const baseX = entity.getLocalPosition().x;
      const baseZ = entity.getLocalPosition().z;
      entity.setLocalPosition(baseX, 3.45 + Math.sin(this.timeElapsed * 2.2 + index) * 0.12, baseZ);
      entity.rotateLocal(0, 0.6, 0);
    });

    this.avatarRoot.setLocalPosition(0, Math.sin(this.timeElapsed * 1.6) * 0.05, 3.8);
  }

  private animateDoor(dt: number): void {
    if (!this.isDoorOpening && !this.progress.cleared) {
      return;
    }

    this.doorOpenAmount = Math.min(1, this.doorOpenAmount + dt * 0.75);
    const eased = pc.math.smoothstep(0, 1, this.doorOpenAmount);
    this.doorRoot.setLocalPosition(0, eased * 4.2, -11.45);

    if (this.doorOpenAmount >= 1 && !this.clearShown) {
      this.clearShown = true;
      this.progress.cleared = true;
      this.progressStore.save(this.progress);
      this.syncUi();
      this.ui.showClear();
    }
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
