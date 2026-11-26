// Fiches de résultats et règles de comparaison (port de bas_Ronde : CompareFiche & cie)

export interface Fiche {
  /** Matchs gagnés */
  MG: number;
  /** Matchs perdus */
  MP: number;
  /** Points pour */
  PP: number;
  /** Points contre */
  PC: number;
  /** Gagnés par blanchissage */
  G0: number;
  /** Perdus par blanchissage */
  P0: number;
  /** Gagnés en supplémentaire */
  GS: number;
  /** Perdus en supplémentaire */
  PS: number;
}

export const CHAMPS_FICHE: (keyof Fiche)[] = ['MG', 'MP', 'PP', 'PC', 'G0', 'P0', 'GS', 'PS'];

export const ficheVide = (): Fiche => ({ MG: 0, MP: 0, PP: 0, PC: 0, G0: 0, P0: 0, GS: 0, PS: 0 });

export function ajouterFiche(a: Fiche, b: Fiche): Fiche {
  const r = ficheVide();
  for (const k of CHAMPS_FICHE) r[k] = a[k] + b[k];
  return r;
}

export function fichesEgales(a: Fiche, b: Fiche): boolean {
  return CHAMPS_FICHE.every((k) => a[k] === b[k]);
}

/** Ajoute à la fiche le résultat d'un match vu par un joueur. */
export function inscrireResultat(
  f: Fiche,
  pointsPour: number,
  pointsContre: number,
  blanchissage: boolean,
  supplementaire: boolean,
): void {
  if (pointsPour > pointsContre) {
    f.MG++;
    if (blanchissage) f.G0++;
    if (supplementaire) f.GS++;
  } else if (pointsPour < pointsContre) {
    f.MP++;
    if (blanchissage) f.P0++;
    if (supplementaire) f.PS++;
  }
  f.PP += pointsPour;
  f.PC += pointsContre;
}

/*
 * Convention des comparateurs : résultat > 0 si `a` est meilleur que `b`,
 * < 0 si `a` est moins bon, 0 si égal. (Access renvoyait 1 / 2 / 0.)
 */

/** Victoires, défaites, [différentiel], points pour, points contre. */
export function compareFiche(a: Fiche, b: Fiche, deltaAvantPP: boolean): number {
  if (a.MG !== b.MG) return a.MG - b.MG;
  if (a.MP !== b.MP) return b.MP - a.MP;
  if (deltaAvantPP) {
    const da = a.PP - a.PC;
    const db = b.PP - b.PC;
    if (da !== db) return da - db;
  }
  if (a.PP !== b.PP) return a.PP - b.PP;
  if (a.PC !== b.PC) return b.PC - a.PC;
  return 0;
}

/** Plus de blanchissages donnés, puis moins de blanchissages subis. */
export function compareBlanchissages(a: Fiche, b: Fiche): number {
  if (a.G0 !== b.G0) return a.G0 - b.G0;
  if (a.P0 !== b.P0) return b.P0 - a.P0;
  return 0;
}

/** Moins de matchs en supplémentaire, puis plus de gagnés, puis moins de perdus. */
export function compareSupplementaires(a: Fiche, b: Fiche): number {
  const ta = a.GS + a.PS;
  const tb = b.GS + b.PS;
  if (ta !== tb) return tb - ta;
  if (a.GS !== b.GS) return a.GS - b.GS;
  if (a.PS !== b.PS) return b.PS - a.PS;
  return 0;
}

/**
 * Fiche à vie (tournois antérieurs) : dernier bris d'égalité.
 * Le code Access de CompareFicheVie n'a pas pu être récupéré ; on compare
 * la fiche comme les autres (victoires, défaites, points...).
 */
export function compareFicheVie(a: Fiche, b: Fiche, deltaAvantPP: boolean): number {
  return compareFiche(a, b, deltaAvantPP);
}

/** Cote : proportion de matchs gagnés (0 à 1). */
export function cote(f: Pick<Fiche, 'MG' | 'MP'>): number {
  const n = f.MG + f.MP;
  return n === 0 ? 0 : f.MG / n;
}

/** Pourcentage de points marqués (0 à 1). */
export function pourcentPoints(f: Pick<Fiche, 'PP' | 'PC'>): number {
  const n = f.PP + f.PC;
  return n === 0 ? 0 : f.PP / n;
}
