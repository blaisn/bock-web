// Règles de pointage d'un match (port de ValideScore, ScoresParDéfaut, supplémentaire, blanchissage)

/**
 * Un match se gagne en atteignant `max` points (3 de 5 → max = 3, 4 de 7 → max = 4).
 * Pointages permis : max contre 0..max-1, ou max+1 contre max (supplémentaire).
 * 0-0 signifie « match non joué » (efface le match).
 */
export function scoreValide(max: number, s1: number, s2: number): boolean {
  if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 < 0 || s2 < 0) return false;
  if (s1 === 0 && s2 === 0) return true;
  const [h, b] = s1 >= s2 ? [s1, s2] : [s2, s1];
  if (h === max && b < max) return true;
  if (h === max + 1 && b === max) return true;
  return false;
}

export function estSupplementaire(max: number, s1: number, s2: number): boolean {
  return (s1 === max + 1 && s2 === max) || (s2 === max + 1 && s1 === max);
}

export function estBlanchissage(max: number, s1: number, s2: number): boolean {
  return (s1 === max && s2 === 0) || (s2 === max && s1 === 0);
}

/** Pointage proposé pour l'adversaire quand on saisit celui d'un joueur. */
export function scoreParDefaut(max: number, saisi: number): number | null {
  if (saisi < max) return max;
  if (saisi === max + 1) return max;
  return null; // saisi = max : on ne devine pas le pointage du perdant
}
