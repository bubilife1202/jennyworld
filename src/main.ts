import './style.css';
import { JennyworldGame } from './game/JennyworldGame';
import { OverlayUI } from './game/ui';

type JennyworldWindow = Window & {
  __jennyworldDebug?: {
    game: JennyworldGame;
    ui: OverlayUI;
  };
  advanceTime?: (ms: number) => void;
  render_game_to_text?: () => string;
};

const mount = document.querySelector<HTMLDivElement>('#app');

if (!mount) {
  throw new Error('App mount element was not found.');
}

const ui = new OverlayUI(mount);
const game = new JennyworldGame(ui.canvas, ui);

Object.assign(window as JennyworldWindow, {
  __jennyworldDebug: { game, ui },
  advanceTime: (ms: number) => {
    game.advanceTime(ms);
  },
  render_game_to_text: () => game.renderGameToText(),
});

ui.setHandlers({
  onAction: () => game.handleAction(),
  onReset: () => game.resetStage(),
  onNextStage: () => {
    if (game.getCurrentStage() >= 4) {
      game.resetStage();
    } else {
      game.transitionToNextStage();
    }
  },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ui.destroy();
    game.destroy();
  });
}
