// Plan morning-digest § 1. The contract every part of § 2 builds against: the page, the JSON
// and the board all read a night through readNight, so they cannot disagree (ADR 0001).

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing at the edge.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the log's offset, as written; never converted to UTC.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // the latest `error` seen for this job, even if it later passed
  first: string; // `at` of the job's first line
  last: string; // `at` of the job's last line
};

export type DigestNight = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
  counts: Record<RunStatus, number>; // lines per status, for the board
};

// Returns null when the night has no file (or `night` is not YYYY-MM-DD): the routes answer 404.
// An empty file returns a night with no rows.
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
