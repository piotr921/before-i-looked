import type { ReadNight } from './types.js';

// Signature only, so § 2 can build against it; the reader lands with the rest of #1.
export const readNight: ReadNight = () => {
  throw new Error('readNight: not implemented yet (#1)');
};
