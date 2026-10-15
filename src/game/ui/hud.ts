import type { Inventory, ItemStack } from "../items/inventory";
import { MAX_AIR, type Vitals } from "../player/vitals";
import type { Experience } from "../player/experience";
import { itemIcon } from "../render/items";
import { getItem } from "../world/blocks";
import { h, px } from "./dom";

/** Renders an item stack into a slot element (shared with inventory screens). */
export function renderStack(target: HTMLElement, stack: ItemStack | null) {
  const key = stack ? `${stack.id}:${stack.count}:${stack.wear ?? 0}` : "";
  if (target.dataset.stack === key) return;
  target.dataset.stack = key;
  target.replaceChildren();
  if (!stack) return;
  const wrap = h("div.bv-item", {}, h("img", { src: itemIcon(stack.id), alt: "", draggable: "false" }));
  if (stack.count > 1) wrap.append(h("span.bv-count", {}, String(stack.count)));
  const max = getItem(stack.id)?.durability;
  if (max && stack.wear) {
    // Remaining durability, green when fresh through red when about to break.
    const left = Math.max(0, 1 - stack.wear / max);
    const fill = h("span.bv-durability-fill", { style: `width:${Math.round(left * 100)}%;background:hsl(${Math.round(left * 120)},100%,45%)` });
    wrap.append(h("span.bv-durability", {}, fill));
  }
  target.append(wrap);
}

export class Hud {
  readonly el: HTMLDivElement;
  private hotbar: HTMLDivElement;
  private selector: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private heldName: HTMLDivElement;
  private hintBar: HTMLDivElement;
  private hintTimer = 0;
  private heldTimer = 0;
  private lastSelected = -1;
  private lastHeldId = -1;
  private debugLeft: HTMLDivElement;
  private debugRight: HTMLDivElement;
  private fps: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastTimer = 0;
  readonly underwater: HTMLDivElement;
  private clickToPlay: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private vignette: HTMLDivElement;
  private vitalsEl: HTMLDivElement;
  private hearts: HTMLDivElement[] = [];
  private foods: HTMLDivElement[] = [];
  private bubbles: HTMLDivElement[] = [];
  private armorIcons: HTMLDivElement[] = [];
  private armorRow: HTMLDivElement;
  private xpBar: HTMLDivElement;
  private xpFill: HTMLDivElement;
  private xpLevel: HTMLDivElement;
  private xpKey = "";
  private bubbleRow: HTMLDivElement;
  private vitalsKey = "";
  private hurt: HTMLDivElement;
  private toasts: HTMLDivElement;

  constructor() {
    this.underwater = h("div.bv-underwater.bv-hidden");
    this.vignette = h("div.bv-vignette");
    this.crosshair = h("div.bv-crosshair");
    this.selector = h("div.bv-hotbar-selector");
    this.hotbar = h("div.bv-hotbar", {}, this.selector);
    for (let i = 0; i < 9; i++) {
      const slot = h("div.bv-hotbar-slot", { style: `left: ${px(3 + i * 20)}` });
      this.slots.push(slot);
      this.hotbar.append(slot);
    }
    this.heldName = h("div.bv-held-name.bv-text", { style: "opacity: 0" });
    this.hintBar = h("div.bv-hint-bar.bv-text", { style: "opacity: 0" });
    const heartRow = h("div.bv-vitals-row");
    const foodRow = h("div.bv-vitals-row.is-right");
    this.bubbleRow = h("div.bv-vitals-row.is-right.is-air");
    this.armorRow = h("div.bv-vitals-row.is-air");
    for (let i = 0; i < 10; i++) {
      const heart = h("div.bv-icon", { style: `left:${px(i * 8)}` });
      const food = h("div.bv-icon", { style: `right:${px(i * 8)}` });
      const bubble = h("div.bv-icon", { style: `right:${px(i * 8)}` });
      const armor = h("div.bv-icon", { style: `left:${px(i * 8)}` });
      this.armorIcons.push(armor);
      this.armorRow.append(armor);
      this.hearts.push(heart);
      this.foods.push(food);
      this.bubbles.push(bubble);
      heartRow.append(heart);
      foodRow.append(food);
      this.bubbleRow.append(bubble);
    }
    this.vitalsEl = h("div.bv-vitals.bv-hidden", {}, heartRow, foodRow, this.bubbleRow, this.armorRow);
    this.xpFill = h("div.bv-xp-fill");
    this.xpLevel = h("div.bv-xp-level");
    this.xpBar = h("div.bv-xp.bv-hidden", {}, this.xpFill, this.xpLevel);
    this.hurt = h("div.bv-hurt", { style: "opacity: 0" });
    this.toasts = h("div.bv-toasts");
    this.debugLeft = h("div.bv-debug.bv-text");
    this.debugRight = h("div.bv-debug.is-right.bv-text");
    this.fps = h("div.bv-fps.bv-text.bv-hidden");
    this.toast = h("div.bv-toast.bv-text");
    this.clickToPlay = h("div.bv-click-to-play.bv-text.bv-hidden", {}, "Click to continue");
    this.el = h("div.bv-layer.bv-hud", {},
      this.underwater, this.hurt, this.vignette, this.crosshair, this.hotbar, this.xpBar, this.vitalsEl, this.heldName, this.hintBar,
      this.debugLeft, this.debugRight, this.fps, this.toast, this.clickToPlay, this.toasts);
    this.el.style.pointerEvents = "none";
  }

  set visible(v: boolean) {
    this.el.classList.toggle("bv-hidden", !v);
  }

  /** F1: hide everything but the world. */
  set minimal(v: boolean) {
    for (const node of [this.crosshair, this.hotbar, this.heldName, this.vignette]) node.classList.toggle("bv-hidden", v);
    this.vitalsEl.style.visibility = v ? "hidden" : "";
  }

  set showClickToPlay(v: boolean) {
    this.clickToPlay.classList.toggle("bv-hidden", !v);
  }

  updateHotbar(inv: Inventory, dt: number) {
    for (let i = 0; i < 9; i++) renderStack(this.slots[i], inv.slots[i]);
    if (inv.selected !== this.lastSelected) {
      this.lastSelected = inv.selected;
      this.selector.style.left = px(-1 + inv.selected * 20);
    }
    const held = inv.held;
    const heldId = held?.id ?? 0;
    if (heldId !== this.lastHeldId) {
      this.lastHeldId = heldId;
      if (heldId) {
        this.heldName.textContent = getItem(heldId)?.name ?? "";
        this.heldTimer = 2;
      } else {
        this.heldTimer = 0;
      }
    }
    this.heldTimer = Math.max(0, this.heldTimer - dt);
    this.heldName.style.opacity = this.heldTimer > 0.4 ? "1" : String(this.heldTimer / 0.4);
  }

  private playerList: HTMLDivElement | null = null;
  private playerListKey = "";

  /** Who's in the world (shown while Tab is held), or null to hide it. */
  setPlayerList(names: string[] | null, title = "") {
    const key = names ? title + names.join("|") : "";
    if (key === this.playerListKey) return;
    this.playerListKey = key;
    this.playerList?.remove();
    this.playerList = null;
    if (!names) return;
    this.playerList = h("div.bv-player-list.bv-text", {},
      h("div.bv-player-list-title", {}, title),
      ...names.map((n) => h("div.bv-player-list-name", {}, n)),
    );
    this.el.append(this.playerList);
  }

  setDebug(left: string[] | null, right: string[] = []) {
    this.debugLeft.classList.toggle("bv-hidden", !left);
    this.debugRight.classList.toggle("bv-hidden", !left);
    if (!left) return;
    const fill = (el: HTMLElement, lines: string[]) => {
      while (el.children.length < lines.length) el.append(h("span"));
      while (el.children.length > lines.length) el.lastChild!.remove();
      lines.forEach((line, i) => {
        const span = el.children[i] as HTMLElement;
        if (span.textContent !== line) span.textContent = line;
        span.style.visibility = line ? "visible" : "hidden";
      });
    };
    fill(this.debugLeft, left);
    fill(this.debugRight, right);
  }

  setFps(text: string | null) {
    this.fps.classList.toggle("bv-hidden", text === null);
    if (text !== null && this.fps.textContent !== text) this.fps.textContent = text;
  }

  showToast(text: string, seconds = 2) {
    this.toast.textContent = text;
    this.toast.classList.add("is-visible");
    this.toastTimer = seconds;
  }

  /** Experience bar and level, hidden outside Survival. */
  updateXp(xp: Experience | null) {
    this.xpBar.classList.toggle("bv-hidden", !xp);
    if (!xp) return;
    const { level, progress } = { level: xp.level, progress: xp.progress };
    const key = `${level}:${progress.toFixed(3)}`;
    if (key === this.xpKey) return;
    this.xpKey = key;
    this.xpFill.style.transform = `scaleX(${progress.toFixed(3)})`;
    this.xpLevel.textContent = level > 0 ? String(level) : "";
  }

  /** Hearts, hunger, armor and air above the hotbar; hidden outside Survival. */
  updateVitals(vitals: Vitals | null, armorPoints = 0) {
    this.vitalsEl.classList.toggle("bv-hidden", !vitals);
    this.armorRow.classList.toggle("bv-hidden", !vitals || armorPoints <= 0);
    if (vitals && armorPoints > 0) {
      this.armorIcons.forEach((el, i) => {
        const img = armorPoints >= i * 2 + 2 ? "var(--bv-armor-full)" : armorPoints === i * 2 + 1 ? "var(--bv-armor-half)" : "var(--bv-armor-empty)";
        if (el.style.backgroundImage !== img) el.style.backgroundImage = img;
      });
    }
    this.hurt.style.opacity = vitals && vitals.hurtTime < 0.5 ? String((1 - vitals.hurtTime / 0.5) * 0.85) : "0";
    if (!vitals) return;
    const health = Math.ceil(vitals.health);
    const air = vitals.air;
    const bubbles = air >= MAX_AIR ? -1 : Math.ceil((air / MAX_AIR) * 10);
    const flash = vitals.hurtTime < 0.5 && Math.floor(vitals.hurtTime * 8) % 2 === 0;
    const key = `${health}:${vitals.food}:${bubbles}:${flash}`;
    if (key !== this.vitalsKey) {
      this.vitalsKey = key;
      const pick = (value: number, i: number, full: string, half: string, empty: string) =>
        value >= i * 2 + 2 ? full : value === i * 2 + 1 ? half : empty;
      this.hearts.forEach((el, i) => {
        el.style.backgroundImage = pick(health, i, "var(--bv-heart-full)", "var(--bv-heart-half)", "var(--bv-heart-empty)");
        el.classList.toggle("is-flash", flash);
      });
      this.foods.forEach((el, i) => (el.style.backgroundImage = pick(vitals.food, i, "var(--bv-food-full)", "var(--bv-food-half)", "var(--bv-food-empty)")));
      this.bubbleRow.classList.toggle("bv-hidden", bubbles < 0);
      this.bubbles.forEach((el, i) => (el.style.visibility = i < bubbles ? "visible" : "hidden"));
      if (bubbles >= 0) this.bubbles.forEach((el) => (el.style.backgroundImage = "var(--bv-bubble)"));
    }
    // Low health makes the hearts tremble; an empty stomach shakes the food bar.
    const shake = (els: HTMLDivElement[], on: boolean) =>
      els.forEach((el) => (el.style.transform = on ? `translateY(${px(Math.round(Math.random() * 2 - 1))})` : ""));
    shake(this.hearts, health <= 4);
    shake(this.foods, vitals.saturation <= 0 && vitals.food <= 6);
  }

  /** Slide-in card in the top-right corner when an achievement unlocks. */
  showAchievement(title: string, iconSrc: string, challenge: boolean) {
    const card = h(`div.bv-ach-toast${challenge ? ".is-challenge" : ""}` as "div", {},
      h("img", { src: iconSrc, alt: "" }),
      h("div.bv-ach-toast-text", {},
        h("div.bv-text.bv-ach-toast-kind", {}, challenge ? "Challenge Complete!" : "Achievement Unlocked!"),
        h("div.bv-text", {}, title),
      ),
    );
    this.toasts.append(card);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("is-in")));
    setTimeout(() => {
      card.classList.remove("is-in");
      setTimeout(() => card.remove(), 400);
    }, 4500);
  }

  /** Action-bar message above the hotbar. */
  showHint(text: string, seconds = 4) {
    this.hintBar.textContent = text;
    this.hintTimer = seconds;
    this.hintBar.style.opacity = "1";
  }

  tick(dt: number) {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      this.hintBar.style.opacity = this.hintTimer > 0.5 ? "1" : String(Math.max(0, this.hintTimer / 0.5));
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove("is-visible");
    }
  }
}
