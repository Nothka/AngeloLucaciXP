/**
 * Survival stats, following the classic rules: hunger drains through
 * "exhaustion" from sprinting, jumping, swimming, mining and healing; a full
 * stomach regenerates health; an empty one starves you (down to half a heart).
 */
export const MAX_HEALTH = 20;
export const MAX_FOOD = 20;
export const MAX_AIR = 300;

export type DamageCause = "fall" | "drown" | "starve" | "void" | "mob" | "arrow";

export interface VitalsData {
  health: number;
  food: number;
  saturation: number;
  air: number;
}

export class Vitals {
  health = MAX_HEALTH;
  food = MAX_FOOD;
  saturation = 5;
  exhaustion = 0;
  /** Ticks of breath left under water (300 = 15 s). */
  air = MAX_AIR;
  /** Seconds since the last hit; drives the red flash and camera shake. */
  hurtTime = 10;
  lastCause: DamageCause | null = null;
  onHurt: ((amount: number, cause: DamageCause) => void) | null = null;
  private healTimer = 0;
  private starveTimer = 0;
  private drownTimer = 0;
  private invulnerable = 0;

  get dead() {
    return this.health <= 0;
  }

  exhaust(amount: number) {
    this.exhaustion = Math.min(40, this.exhaustion + amount);
  }

  damage(amount: number, cause: DamageCause) {
    if (this.dead || amount <= 0) return;
    if (this.invulnerable > 0 && cause !== "void") return;
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = 0.5;
    this.hurtTime = 0;
    this.lastCause = cause;
    this.exhaust(0.1);
    this.onHurt?.(amount, cause);
  }

  eat(hunger: number, saturation: number) {
    this.food = Math.min(MAX_FOOD, this.food + hunger);
    this.saturation = Math.min(this.food, this.saturation + saturation);
  }

  tick(dt: number, headInWater: boolean) {
    this.hurtTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.dead) return;

    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.food = Math.max(0, this.food - 1);
    }

    // Natural regeneration: fast while saturated and full, slow at 9+ shanks.
    this.healTimer += dt;
    if (this.health < MAX_HEALTH && this.food >= 20 && this.saturation > 0) {
      if (this.healTimer >= 0.5) {
        this.healTimer = 0;
        const cost = Math.min(this.saturation, 6);
        this.health = Math.min(MAX_HEALTH, this.health + cost / 6);
        this.exhaust(cost);
      }
    } else if (this.health < MAX_HEALTH && this.food >= 18) {
      if (this.healTimer >= 4) {
        this.healTimer = 0;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
        this.exhaust(6);
      }
    } else {
      this.healTimer = Math.min(this.healTimer, 4);
    }

    if (this.food <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer = 0;
        if (this.health > 1) this.damage(1, "starve");
      }
    } else {
      this.starveTimer = 0;
    }

    if (headInWater) {
      this.air = Math.max(0, this.air - dt * 20);
      if (this.air <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1) {
          this.drownTimer = 0;
          this.damage(2, "drown");
        }
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + dt * 100);
      this.drownTimer = 0;
    }
  }

  reset() {
    this.health = MAX_HEALTH;
    this.food = MAX_FOOD;
    this.saturation = 5;
    this.exhaustion = 0;
    this.air = MAX_AIR;
    this.hurtTime = 10;
    this.invulnerable = 0;
  }

  serialize(): VitalsData {
    return { health: this.health, food: this.food, saturation: this.saturation, air: this.air };
  }

  load(data: VitalsData | undefined) {
    if (!data) return;
    this.health = Math.max(1, Math.min(MAX_HEALTH, data.health));
    this.food = Math.max(0, Math.min(MAX_FOOD, data.food));
    this.saturation = Math.max(0, Math.min(this.food, data.saturation));
    this.air = Math.max(0, Math.min(MAX_AIR, data.air));
  }
}
