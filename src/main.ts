import './style.css';
import { JennyworldGame } from './game/JennyworldGame';
import { OverlayUI } from './game/ui';

const mount = document.querySelector<HTMLDivElement>('#app');

if (!mount) {
  throw new Error('App mount element was not found.');
}

const ui = new OverlayUI(mount);
const game = new JennyworldGame(ui.canvas, ui);

ui.setHandlers({
  onStart: () => game.focus(),
  onReset: () => game.resetStage(),
  onOpenPuzzle: (puzzleId) => game.openPuzzle(puzzleId),
  onOpenDoor: () => game.tryOpenDoor(),
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy();
  });
}
