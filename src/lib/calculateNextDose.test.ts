/**
 * calculateNextDose.test.ts
 *
 * Covers all three frequency_types:
 *   - fixed_interval (legacy)
 *   - specific_times
 *   - specific_days
 *
 * Reference time used across tests:
 *   2026-06-16T10:00 São Paulo (Tuesday) = 2026-06-16T13:00:00Z UTC
 *
 * Helpers:
 *   sp("2026-06-16T14:00") → UTC Date parsed as SP wall-clock time
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateNextDose } from "./calculateNextDose";
import { parseDateInSP } from "./dateUtils";

// Reference wall-clock time: Tuesday 2026-06-16 at 10:00 SP (UTC 13:00)
const REF_SP_10H = parseDateInSP("2026-06-16T10:00")!; // UTC 2026-06-16T13:00:00Z

/** Creates a UTC Date from a São Paulo wall-clock datetime string. */
function sp(dateTimeStr: string): Date {
  const d = parseDateInSP(dateTimeStr);
  if (!d) throw new Error(`Invalid SP datetime: ${dateTimeStr}`);
  return d;
}

/** Formats a UTC Date as "YYYY-MM-DDTHH:MM" in São Paulo for readable assertions. */
function fmtSP(date: Date | null): string | null {
  if (!date) return null;
  // UTC-3 offset
  const sp = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const y = sp.getUTCFullYear();
  const mo = String(sp.getUTCMonth() + 1).padStart(2, "0");
  const d = String(sp.getUTCDate()).padStart(2, "0");
  const h = String(sp.getUTCHours()).padStart(2, "0");
  const mi = String(sp.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

// ─────────────────────────────────────────────────────────
// FIXED INTERVAL (legacy)
// ─────────────────────────────────────────────────────────
describe("calculateNextDose — fixed_interval", () => {
  it("returns null when startDateStr is missing", () => {
    expect(calculateNextDose(null, 8, null, REF_SP_10H, "fixed_interval")).toBeNull();
  });

  it("returns null when frequencyHours is missing or zero", () => {
    expect(calculateNextDose("2026-06-16", null, null, REF_SP_10H, "fixed_interval")).toBeNull();
    expect(calculateNextDose("2026-06-16", 0, null, REF_SP_10H, "fixed_interval")).toBeNull();
  });

  it("returns start date when start is still in the future", () => {
    const start = "2026-06-17T08:00";
    const result = calculateNextDose(start, 8, null, REF_SP_10H, "fixed_interval");
    expect(fmtSP(result)).toBe("2026-06-17T08:00");
  });

  it("advances from start by frequency_hours until past ref", () => {
    // start = today 08:00, freq = 8h, ref = 10:00 → next = 16:00
    const result = calculateNextDose("2026-06-16T08:00", 8, null, REF_SP_10H, "fixed_interval");
    expect(fmtSP(result)).toBe("2026-06-16T16:00");
  });

  it("returns null when next dose is past end date", () => {
    // start = 2026-06-15 08:00, freq = 8h, ref = 10:00 → next = 16:00 today, but end = 2026-06-16
    const result = calculateNextDose(
      "2026-06-15T08:00",
      8,
      "2026-06-16", // ends at 23:59:59 today → next 16:00 should be within
      REF_SP_10H,
      "fixed_interval"
    );
    // 16:00 today is before end of day 2026-06-16, so should be returned
    expect(fmtSP(result)).toBe("2026-06-16T16:00");
  });

  it("returns null when next dose would be after end date", () => {
    // start = 2026-06-14 08:00, freq = 24h, ref = 10:00 today → next = 2026-06-15 08:00 ... → next past end
    const result = calculateNextDose(
      "2026-06-14T08:00",
      24,
      "2026-06-15", // ended yesterday
      REF_SP_10H,
      "fixed_interval"
    );
    expect(result).toBeNull();
  });

  it("defaults to fixed_interval when frequencyType is null", () => {
    // No explicit frequencyType → falls back to fixed_interval
    const result = calculateNextDose("2026-06-16T08:00", 8, null, REF_SP_10H, null);
    expect(fmtSP(result)).toBe("2026-06-16T16:00");
  });
});

// ─────────────────────────────────────────────────────────
// SPECIFIC TIMES
// ─────────────────────────────────────────────────────────
describe("calculateNextDose — specific_times", () => {
  it("returns null when specificTimes is empty", () => {
    const result = calculateNextDose(null, null, null, REF_SP_10H, "specific_times", []);
    expect(result).toBeNull();
  });

  it("returns null when specificTimes is null", () => {
    const result = calculateNextDose(null, null, null, REF_SP_10H, "specific_times", null);
    expect(result).toBeNull();
  });

  it("returns next future time today (ref=10:00, times=[08:00,14:00,22:00])", () => {
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_times", ["08:00", "14:00", "22:00"]
    );
    expect(fmtSP(result)).toBe("2026-06-16T14:00");
  });

  it("returns first time tomorrow when all times passed today (ref=10:00, times=[08:00,09:00])", () => {
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_times", ["08:00", "09:00"]
    );
    expect(fmtSP(result)).toBe("2026-06-17T08:00");
  });

  it("handles unsorted input — still finds correct next time", () => {
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_times", ["22:00", "08:00", "14:00"]
    );
    expect(fmtSP(result)).toBe("2026-06-16T14:00");
  });

  it("returns null when next dose would be after end date", () => {
    // ref=10:00, times=[14:00], end=2026-06-15 (yesterday)
    const result = calculateNextDose(
      null, null, "2026-06-15",
      REF_SP_10H, "specific_times", ["14:00"]
    );
    expect(result).toBeNull();
  });

  it("returns first time on future start day when start is tomorrow", () => {
    const result = calculateNextDose(
      "2026-06-17", null, null,
      REF_SP_10H, "specific_times", ["08:00", "14:00"]
    );
    expect(fmtSP(result)).toBe("2026-06-17T08:00");
  });

  it("skips today times when start is today — uses fake timers", () => {
    // Pin wall clock to 2026-06-16T10:00 SP = UTC 13:00
    vi.useFakeTimers();
    vi.setSystemTime(sp("2026-06-16T10:00"));

    // Start = today, times = [08:00 (past), 14:00 (future)]
    const result = calculateNextDose(
      "2026-06-16", null, null,
      REF_SP_10H, "specific_times", ["08:00", "14:00"]
    );
    expect(fmtSP(result)).toBe("2026-06-16T14:00");

    vi.useRealTimers();
  });

  it("advances to tomorrow when all today's times passed — uses fake timers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(sp("2026-06-16T10:00"));

    // Start = today, only time = 08:00 (already past)
    const result = calculateNextDose(
      "2026-06-16", null, null,
      REF_SP_10H, "specific_times", ["08:00"]
    );
    expect(fmtSP(result)).toBe("2026-06-17T08:00");

    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────
// SPECIFIC DAYS
// ─────────────────────────────────────────────────────────
describe("calculateNextDose — specific_days", () => {
  // REF = Tuesday 2026-06-16 at 10:00 SP → JS day = 2

  it("returns null when specificDays is empty", () => {
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_days", ["14:00"], []
    );
    expect(result).toBeNull();
  });

  it("returns next time TODAY when today is an allowed day and time is still future", () => {
    // Today is Tuesday (2), time 14:00 > 10:00 ref → returns 14:00 today
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_days", ["14:00"], [2]
    );
    expect(fmtSP(result)).toBe("2026-06-16T14:00");
  });

  it("skips today when all today's times have passed and moves to next allowed day", () => {
    // Today is Tuesday (2), time 08:00 < 10:00 ref → skip; next allowed: Friday (5) = 2026-06-19
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_days", ["08:00"], [2, 5]
    );
    expect(fmtSP(result)).toBe("2026-06-19T08:00");
  });

  it("returns next allowed day when today is NOT in the list", () => {
    // Today is Tuesday (2); allowed = [3=Wed, 5=Fri]; next = Wed 2026-06-17
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_days", ["09:00"], [3, 5]
    );
    expect(fmtSP(result)).toBe("2026-06-17T09:00");
  });

  it("wraps around the week (Sunday next)", () => {
    // Today is Tuesday (2); only allowed day = Sunday (0); next = 2026-06-21
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_days", ["10:00"], [0]
    );
    expect(fmtSP(result)).toBe("2026-06-21T10:00");
  });

  it("defaults to 08:00 when specificTimes is empty", () => {
    // No specificTimes provided → defaults to ["08:00"]
    const result = calculateNextDose(
      null, null, null, REF_SP_10H,
      "specific_days", [], [3]
    );
    expect(fmtSP(result)).toBe("2026-06-17T08:00");
  });

  it("returns null when next dose is after end date", () => {
    // Next occurrence = Wed 2026-06-17, end = 2026-06-16 (today)
    const result = calculateNextDose(
      null, null, "2026-06-16",
      REF_SP_10H, "specific_days", ["09:00"], [3]
    );
    expect(result).toBeNull();
  });

  it("returns first time on start day when start is a future allowed day", () => {
    // Start = Friday 2026-06-19 (future), allowed = [5=Fri], time = 09:00
    const result = calculateNextDose(
      "2026-06-19", null, null,
      REF_SP_10H, "specific_days", ["09:00"], [5]
    );
    expect(fmtSP(result)).toBe("2026-06-19T09:00");
  });
});

afterEach(() => {
  vi.useRealTimers();
});
