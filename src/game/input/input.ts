export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Keyboard + mouse state for the game loop. Edge-triggered sets (`pressed`,
 * `clicked`) collect events between frames and are cleared by `endFrame()`.
 */
export class Input {
  readonly keys = new Set<string>();
  readonly pressed = new Set<string>();
  readonly buttons = new Set<number>();
  readonly clicked = new Set<number>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  /** False while a menu owns the keyboard; game keys are then ignored. */
  captureKeys = false;
  onLockChange: ((locked: boolean) => void) | null = null;
  onLockError: (() => void) | null = null;
  private lastTap = new Map<string, number>();
  /** Left buttons that were Ctrl-held on a Mac and therefore act as right clicks. */
  private ctrlClick = false;
  private doubleTaps = new Set<string>();
  private teardown: (() => void)[] = [];
  /**
   * Cleared once the browser turns down raw mouse input. Re-locking without a click
   * (closing the inventory with E or Esc) is allowed only once after we let go, so a
   * refused first try would use that up and the plain retry would need a click.
   */
  private unadjusted = true;

  constructor(private element: HTMLElement) {
    const on = <K extends keyof DocumentEventMap>(target: Document | Window, type: K, fn: (e: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.teardown.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };

    on(document, "keydown", (e) => {
      if (isTyping(e)) return;
      if (!this.captureKeys) {
        this.pressed.add(e.code);
        return;
      }
      if (GAME_KEYS.has(e.code) || e.code.startsWith("Digit") || e.code.startsWith("F")) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        const now = performance.now();
        const last = this.lastTap.get(e.code) ?? -1e9;
        if (now - last < 300) {
          this.doubleTaps.add(e.code);
          this.lastTap.set(e.code, -1e9);
        } else {
          this.lastTap.set(e.code, now);
        }
      }
      this.keys.add(e.code);
    });
    on(document, "keyup", (e) => {
      this.keys.delete(e.code);
    });
    on(window, "blur", () => {
      this.keys.clear();
      this.buttons.clear();
    });
    on(document, "mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    on(document, "mousedown", (e) => {
      if (!this.locked) return;
      let button = e.button;
      // macOS convention: Control-click is the secondary click.
      if (IS_MAC && button === 0 && e.ctrlKey) {
        button = 2;
        this.ctrlClick = true;
      }
      this.buttons.add(button);
      this.clicked.add(button);
      e.preventDefault();
    });
    on(document, "mouseup", (e) => {
      if (e.button === 0 && this.ctrlClick) {
        this.ctrlClick = false;
        this.buttons.delete(2);
        return;
      }
      this.buttons.delete(e.button);
    });
    on(document, "wheel", (e) => {
      if (!this.locked) return;
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    on(document, "contextmenu", (e) => e.preventDefault());
    on(document, "pointerlockchange", () => {
      const locked = document.pointerLockElement === this.element;
      if (locked === this.locked) return;
      this.locked = locked;
      if (!locked) {
        this.buttons.clear();
        this.keys.clear();
      }
      this.onLockChange?.(locked);
    });
    on(document, "pointerlockerror", () => this.onLockError?.());
  }

  requestLock() {
    if (this.locked) return;
    if (!this.unadjusted) return this.requestPlainLock();
    try {
      const result = this.element.requestPointerLock({ unadjustedMovement: true }) as unknown as Promise<void> | undefined;
      result?.catch?.((e: unknown) => {
        // Some platforms reject unadjusted movement; retry plain, and skip asking from now on.
        if ((e as Error)?.name === "NotSupportedError") this.unadjusted = false;
        this.requestPlainLock();
      });
    } catch {
      this.onLockError?.();
    }
  }

  private requestPlainLock() {
    try {
      const result = this.element.requestPointerLock() as unknown as Promise<void> | undefined;
      result?.catch?.(() => this.onLockError?.());
    } catch {
      this.onLockError?.();
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  doubleTapped(code: string) {
    return this.doubleTaps.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.clicked.clear();
    this.doubleTaps.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }

  dispose() {
    for (const fn of this.teardown) fn();
    this.teardown = [];
  }
}

const GAME_KEYS = new Set([
  "Space", "Tab", "KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "ShiftLeft", "ShiftRight",
  "ControlLeft", "AltLeft", "AltRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
