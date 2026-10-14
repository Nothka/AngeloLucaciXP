/**
 * Experience levels follow the classic curve: each level costs a little more
 * than the last (7, 9, 11, ... then steeper after levels 15 and 30).
 */
export function pointsForNextLevel(level: number): number {
  if (level >= 30) return 9 * level - 158;
  if (level >= 15) return 5 * level - 38;
  return 2 * level + 7;
}

/** Level and fraction toward the next one for a running total of points. */
export function levelFromPoints(total: number): { level: number; progress: number } {
  let level = 0;
  let left = Math.max(0, Math.floor(total));
  while (left >= pointsForNextLevel(level)) {
    left -= pointsForNextLevel(level);
    level++;
  }
  return { level, progress: left / pointsForNextLevel(level) };
}

export class Experience {
  total = 0;
  onLevelUp: ((level: number) => void) | null = null;

  get level() {
    return levelFromPoints(this.total).level;
  }

  get progress() {
    return levelFromPoints(this.total).progress;
  }

  add(points: number) {
    const before = this.level;
    this.total += points;
    if (this.level > before) this.onLevelUp?.(this.level);
  }

  /** What a death leaves on the ground (and the rest is lost). */
  dropOnDeath(): number {
    const drop = Math.min(100, this.level * 7);
    this.total = 0;
    return drop;
  }
}
