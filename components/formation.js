// components/formation.js

// Map of supported formations to required counts per position (including bench slots later)
export const FORMATIONS = {
  "3-4-3": { GKP: 1, DEF: 3, MID: 4, FWD: 3 },
  "3-5-2": { GKP: 1, DEF: 3, MID: 5, FWD: 2 },
  "4-4-2": { GKP: 1, DEF: 4, MID: 4, FWD: 2 },
  "4-3-3": { GKP: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-5-1": { GKP: 1, DEF: 4, MID: 5, FWD: 1 },
  "5-3-2": { GKP: 1, DEF: 5, MID: 3, FWD: 2 },
  "5-4-1": { GKP: 1, DEF: 5, MID: 4, FWD: 1 },
  "5-2-3": { GKP: 1, DEF: 5, MID: 2, FWD: 3 }
};

/**
 * Return the position constraints for the given formation string.
 * If the formation is unknown, fall back to the default 4‑3‑3.
 */
export function getFormationConstraints(formation) {
  return FORMATIONS[formation] || FORMATIONS["4-3-3"];
}
