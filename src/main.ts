import './style.css';
import { JennyworldGame } from './game/JennyworldGame';
import { OverlayUI } from './game/ui';

const mount = document.querySelector<HTMLDivElement>('#app');

if (!mount) {
  throw new Error('App mount element was not found.');
}

const ui = new OverlayUI(mount);
const game = new JennyworldGame(ui.canvas, ui);

Object.assign(window as Window & { __jennyworldDebug?: unknown }, {
  __jennyworldDebug: { game, ui },
});

ui.setHandlers({
  onAction: () => game.handleAction(),
  onReset: () => game.resetStage(),
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy();
  });
}
