import { describe, it, expect } from 'vitest';
import {
  activeSecondsFromEvents,
  computeMetrics,
  cableFeetPulled,
  earnedHours,
} from '../src/lib/calculations';

describe('activeSecondsFromEvents', () => {
  it('computes simple start->stop duration', () => {
    const secs = activeSecondsFromEvents([
      { event: 'start', at: '2026-06-09 08:00:00' },
      { event: 'stop', at: '2026-06-09 10:00:00' },
    ]);
    expect(secs).toBe(7200);
  });

  it('excludes paused time', () => {
    const secs = activeSecondsFromEvents([
      { event: 'start', at: '2026-06-09 08:00:00' },
      { event: 'pause', at: '2026-06-09 09:00:00' },
      { event: 'resume', at: '2026-06-09 09:30:00' },
      { event: 'stop', at: '2026-06-09 11:00:00' },
    ]);
    expect(secs).toBe(3600 + 5400); // 1h + 1.5h working
  });

  it('handles multiple pause/resume cycles', () => {
    const secs = activeSecondsFromEvents([
      { event: 'start', at: '2026-06-09 08:00:00' },
      { event: 'pause', at: '2026-06-09 08:10:00' },
      { event: 'resume', at: '2026-06-09 08:20:00' },
      { event: 'pause', at: '2026-06-09 08:30:00' },
      { event: 'resume', at: '2026-06-09 08:40:00' },
      { event: 'stop', at: '2026-06-09 08:50:00' },
    ]);
    expect(secs).toBe(1800); // 3 x 10 min working
  });

  it('uses nowMs for a still-running session', () => {
    const start = Date.parse('2026-06-09T08:00:00Z');
    const secs = activeSecondsFromEvents([{ event: 'start', at: '2026-06-09 08:00:00' }], start + 60_000);
    expect(secs).toBe(60);
  });

  it('ignores out-of-order duplicates gracefully', () => {
    const secs = activeSecondsFromEvents([
      { event: 'stop', at: '2026-06-09 09:00:00' },
      { event: 'start', at: '2026-06-09 08:00:00' },
    ]);
    expect(secs).toBe(3600);
  });
});

describe('computeMetrics', () => {
  it('matches the horn-strobe example: 47 devices, 2 techs, 8 hours', () => {
    const m = computeMetrics(8 * 3600, 2, 47);
    expect(m.totalHours).toBe(8);
    expect(m.manHours).toBe(16);
    expect(m.hoursPerUnit).toBeCloseTo(16 / 47, 4);
    expect(m.unitsPerHour).toBeCloseTo(47 / 8, 4);
    expect(m.unitsPerManHour).toBeCloseTo(47 / 16, 4);
  });

  it('treats crew size below 1 as 1', () => {
    const m = computeMetrics(3600, 0, 10);
    expect(m.manHours).toBe(1);
  });

  it('handles zero quantity without dividing by zero', () => {
    const m = computeMetrics(3600, 2, 0);
    expect(m.hoursPerUnit).toBe(0);
    expect(m.unitsPerHour).toBe(0);
  });

  it('handles zero time without dividing by zero', () => {
    const m = computeMetrics(0, 2, 10);
    expect(m.unitsPerHour).toBe(0);
    expect(m.unitsPerManHour).toBe(0);
  });
});

describe('cableFeetPulled', () => {
  it('matches the three-reel example: 1000/1000/1000 minus 420/125/500', () => {
    const feet = cableFeetPulled([
      { startingLength: 1000, remainingLength: 420 },
      { startingLength: 1000, remainingLength: 125 },
      { startingLength: 1000, remainingLength: 500 },
    ]);
    expect(feet).toBe(580 + 875 + 500);
  });

  it('rejects remaining greater than starting', () => {
    expect(() => cableFeetPulled([{ startingLength: 500, remainingLength: 600 }])).toThrow();
  });

  it('rejects negative remaining', () => {
    expect(() => cableFeetPulled([{ startingLength: 500, remainingLength: -1 }])).toThrow();
  });

  it('allows a fully used reel', () => {
    expect(cableFeetPulled([{ startingLength: 500, remainingLength: 0 }])).toBe(500);
  });
});

describe('earnedHours', () => {
  it('multiplies quantity by the estimating rate', () => {
    expect(earnedHours(47, 1.0)).toBe(47);
    expect(earnedHours(580, 0.01)).toBeCloseTo(5.8, 4);
  });
});
