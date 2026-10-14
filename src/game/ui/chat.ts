import { h } from "./dom";

interface Line {
  el: HTMLDivElement;
  age: number;
}

const SHOW_SECONDS = 10;
const FADE_SECONDS = 1;
const MAX_LINES = 60;

/**
 * Chat box in the bottom-left corner: recent messages fade out after ten
 * seconds; opening the chat (T or /) shows the history and an input line.
 */
export class Chat {
  readonly el: HTMLDivElement;
  readonly input: HTMLInputElement;
  isOpen = false;
  private log: HTMLDivElement;
  private lines: Line[] = [];
  private history: string[] = [];
  private historyPos = 0;
  /** Enter with text: the game runs it. */
  onSubmit: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor() {
    this.log = h("div.bv-chat-log");
    this.input = h("input.bv-chat-input.bv-text.bv-hidden", { maxlength: 256, spellcheck: "false", autocomplete: "off" });
    this.el = h("div.bv-chat", {}, this.log, this.input);
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        const text = this.input.value.trim();
        if (text) {
          this.history.push(text);
          if (this.history.length > 50) this.history.shift();
        }
        this.close();
        if (text) this.onSubmit?.(text);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!this.history.length) return;
        this.historyPos = Math.max(0, Math.min(this.history.length, this.historyPos + (e.key === "ArrowUp" ? -1 : 1)));
        this.input.value = this.history[this.historyPos] ?? "";
      }
    });
  }

  open(prefix = "") {
    this.isOpen = true;
    this.historyPos = this.history.length;
    this.input.value = prefix;
    this.input.classList.remove("bv-hidden");
    this.el.classList.add("is-open");
    this.refresh();
    // Focus after the key that opened the chat has finished, so it is not typed in.
    requestAnimationFrame(() => {
      this.input.focus();
      this.input.setSelectionRange(prefix.length, prefix.length);
    });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.input.blur();
    this.input.classList.add("bv-hidden");
    this.el.classList.remove("is-open");
    this.refresh();
    this.onClose?.();
  }

  /** Adds a message; several lines are split on "\n". */
  print(text: string, tone: "normal" | "error" | "info" = "normal") {
    for (const part of text.split("\n")) {
      const el = h(`div.bv-chat-line.bv-text.is-${tone}` as "div", {}, part);
      this.log.append(el);
      this.lines.push({ el, age: 0 });
    }
    while (this.lines.length > MAX_LINES) this.lines.shift()!.el.remove();
    this.refresh();
  }

  clear() {
    this.lines.forEach((l) => l.el.remove());
    this.lines = [];
  }

  tick(dt: number) {
    for (const l of this.lines) l.age += dt;
    this.refresh();
  }

  private refresh() {
    const n = this.lines.length;
    this.lines.forEach((l, i) => {
      // Open: the last 20 lines, all solid. Closed: recent lines, fading out.
      const visible = this.isOpen ? n - i <= 20 : l.age < SHOW_SECONDS + FADE_SECONDS && n - i <= 10;
      l.el.style.display = visible ? "" : "none";
      l.el.style.opacity = this.isOpen ? "1" : String(Math.max(0, Math.min(1, (SHOW_SECONDS + FADE_SECONDS - l.age) / FADE_SECONDS)));
    });
  }
}
