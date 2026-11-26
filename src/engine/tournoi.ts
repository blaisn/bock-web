// Calculs au niveau d'un tournoi : classement de saison, tableaux, champions

import type { BockData, Match, Tournoi, TypeMatch } from '../model';
import { construireTableau, type Tableau } from './bracket';
import { calculerClassement, type LigneClassement } from './classement';
import { type Fiche, ficheVide, inscrireResultat } from './fiche';

export function getTournoi(data: BockData, id: number): Tournoi {
  const t = data.tournois.find((x) => x.id === id);
  if (!t) throw new Error(`Tournoi ${id} introuvable`);
  return t;
}

export function participantsTournoi(data: BockData, id: number): number[] {
  return data.participations
    .filter((p) => p.tournoi === id)
    .map((p) => p.joueur)
    .sort((a, b) => a - b);
}

export function matchsTournoi(data: BockData, id: number, types?: TypeMatch[]): Match[] {
  return data.matchs.filter((m) => m.tournoi === id && (!types || types.includes(m.type)));
}

/** Fiche à vie de chaque joueur pour tous les matchs (tous types) des tournois antérieurs à `date`. */
export function fichesVieAvant(data: BockData, date: string): Map<number, Fiche> {
  const anterieurs = new Set(data.tournois.filter((t) => t.date < date).map((t) => t.id));
  const fiches = new Map<number, Fiche>();
  const f = (j: number) => {
    if (!fiches.has(j)) fiches.set(j, ficheVide());
    return fiches.get(j)!;
  };
  for (const m of data.matchs) {
    if (!anterieurs.has(m.tournoi)) continue;
    inscrireResultat(f(m.gagnant), m.scoreG, m.scoreP, m.blanchissage, m.supplementaire);
    inscrireResultat(f(m.perdant), m.scoreP, m.scoreG, m.blanchissage, m.supplementaire);
  }
  return fiches;
}

/** Classement d'une ronde : 'Saison' (ou 'Séries' quand les séries se jouent à la ronde). */
export function classementRonde(data: BockData, id: number, type: 'Saison' | 'Séries' = 'Saison'): LigneClassement[] {
  const t = getTournoi(data, id);
  let joueurs = participantsTournoi(data, id);
  if (type === 'Séries') {
    const saison = classementRonde(data, id, 'Saison');
    joueurs = saison.filter((l) => l.rang <= t.nbJoueursSeries).map((l) => l.joueur);
  }
  const rangsForces = new Map<number, number>();
  for (const p of data.participations) {
    const rf = p.rangForce?.[type];
    if (p.tournoi === id && rf) rangsForces.set(p.joueur, rf);
  }
  return calculerClassement({
    joueurs,
    matchs: matchsTournoi(data, id, [type]),
    deltaAvantPP: t.deltaAvantPP,
    pointsGagnants: t.pointsGagnants[type],
    fichesVie: fichesVieAvant(data, t.date),
    rangsForces,
    nbQualifies: type === 'Saison' ? t.nbJoueursSeries : 1,
  });
}

/** Tableau à élimination des séries ou de la consolation, d'après le classement de saison. */
export function tableauTournoi(data: BockData, id: number, type: 'Séries' | 'Consolation'): Tableau | null {
  const t = getTournoi(data, id);
  if (type === 'Séries' && t.typeSeries === 'ronde') return null;
  const saison = classementRonde(data, id, 'Saison');
  const n = t.nbJoueursSeries;
  const tetes = saison
    .filter((l) => (type === 'Séries' ? l.rang <= n : l.rang > n))
    .sort((a, b) => a.rang - b.rang)
    .map((l) => l.joueur);
  // Un seul joueur en consolation : pas de tableau (Access ne couronnait personne)
  if (tetes.length < 2) return null;
  const matchs = matchsTournoi(data, id, type === 'Séries' ? ['Séries', 'Finale'] : ['Consolation']);
  return construireTableau(type, tetes, matchs);
}

export interface Champions {
  saison?: number;
  series?: number;
  consolation?: number;
  /** La saison est-elle terminée (tous les matchs joués) ? */
  saisonTerminee: boolean;
}

export function championsTournoi(data: BockData, id: number): Champions {
  const t = getTournoi(data, id);
  const saison = classementRonde(data, id, 'Saison');
  const saisonTerminee = saison.length > 1 && saison.every((l) => l.matchsRestants === 0);
  const c: Champions = { saisonTerminee };
  if (saison.length && saison[0].statut === 'C') c.saison = saison[0].joueur;
  if (t.typeSeries === 'ronde') {
    const s = classementRonde(data, id, 'Séries');
    if (s.length && s[0].statut === 'C') c.series = s[0].joueur;
  } else {
    c.series = tableauTournoi(data, id, 'Séries')?.champion;
  }
  c.consolation = tableauTournoi(data, id, 'Consolation')?.champion;
  // Champions inscrits manuellement (historique Access) : ils ont préséance
  const ins = t.championsInscrits;
  if (ins) {
    if (ins.saison !== undefined) c.saison = ins.saison ?? undefined;
    if (ins.series !== undefined) c.series = ins.series ?? undefined;
    if (ins.consolation !== undefined) c.consolation = ins.consolation ?? undefined;
  }
  return c;
}
