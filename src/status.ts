import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/reader.js';
import type { RunStatus } from './digest/types.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  // Per night: counts from readNight, or null when it can't be read (renders as `—`).
  nightCounts: Record<string, Record<RunStatus, number> | null>;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  const nightCounts: Status['nightCounts'] = {};
  for (const n of nights) nightCounts[n] = readNight(config.runsDir, n)?.counts ?? null;
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightCounts,
  };
}
