import "@fontsource/silkscreen/400.css";
import "@fontsource/press-start-2p/400.css";
import "./ui/ui.css";
import { Game } from "./game";

const mount = document.getElementById("blockvale")!;
const game = new Game(mount);
if (import.meta.env.DEV) (window as unknown as { __blockvale: Game }).__blockvale = game;
void document.fonts.ready.finally(() => game.start());
