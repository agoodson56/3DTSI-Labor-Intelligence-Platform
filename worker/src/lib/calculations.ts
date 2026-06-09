// Labor Intelligence calculation engine.
// All production metrics in the platform derive from these functions.

export interface SessionEvent {
  event: 'start' | 'pause' | 'resume' | 'stop';
  at: string; // ISO or SQLite datetime string (UTC)
}

export interface ProductionMetrics {
  totalHours: number;        // elapsed clock hours (pauses excluded)
  manHours: number;          // totalHours * crewSize
  hoursPerUnit: number;      // man-hours per device / per foot
  unitsPerHour: number;      // devices or feet per clock hour
  unitsPerManHour: number;   // devices or feet per man-hour
}

function parseDbDate(s: string): number {
  // SQLite datetime('now') => "YYYY-MM-DD HH:MM:SS" (UTC, no zone marker)
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  return new Date(iso).getTime();
}

/**
 * Computes active working seconds from the start/pause/resume/stop event
 * timeline. Paused intervals do not count. If the timeline is still running
 * (no stop), `nowMs` closes the open interval.
 */
export function activeSecondsFromEvents(events: SessionEvent[], nowMs: number = Date.now()): number {
  const sorted = [...events].sort((a, b) => parseDbDate(a.at) - parseDbDate(b.at));
  let total = 0;
  let runningSince: number | null = null;
  for (const ev of sorted) {
    const t = parseDbDate(ev.at);
    switch (ev.event) {
      case 'start':
      case 'resume':
        if (runningSince === null) runningSince = t;
        break;
      case 'pause':
      case 'stop':
        if (runningSince !== null) {
          total += Math.max(0, t - runningSince);
          runningSince = null;
        }
        break;
    }
  }
  if (runningSince !== null) total += Math.max(0, nowMs - runningSince);
  return Math.round(total / 1000);
}

export function computeMetrics(activeSeconds: number, crewSize: number, quantity: number): ProductionMetrics {
  const totalHours = activeSeconds / 3600;
  const manHours = totalHours * Math.max(1, crewSize);
  return {
    totalHours: round4(totalHours),
    manHours: round4(manHours),
    hoursPerUnit: quantity > 0 ? round4(manHours / quantity) : 0,
    unitsPerHour: totalHours > 0 ? round4(quantity / totalHours) : 0,
    unitsPerManHour: manHours > 0 ? round4(quantity / manHours) : 0,
  };
}

export interface ReelInput {
  startingLength: number;
  remainingLength: number;
}

/** Feet pulled = sum(starting - remaining) across all reels on the session. */
export function cableFeetPulled(reels: ReelInput[]): number {
  return round4(
    reels.reduce((sum, r) => {
      const pulled = r.startingLength - r.remainingLength;
      if (r.remainingLength < 0 || r.remainingLength > r.startingLength) {
        throw new Error('Remaining footage must be between 0 and the starting length');
      }
      return sum + pulled;
    }, 0),
  );
}

/** Earned hours = installed quantity x estimating rate (man-hours per unit). */
export function earnedHours(quantity: number, estimateHoursPerUnit: number): number {
  return round4(quantity * estimateHoursPerUnit);
}

export function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
