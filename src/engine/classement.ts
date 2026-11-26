// Classement d'une ronde (round robin) : port de bas_Ronde.GetClassement
//   GetFichesCourantes → GetFichesRelatives → GetFicheVie → tri → GetFicheMinMax → GetMinMax

import type { Match } from '../model';
import {
  type Fiche,
  compareBlanchissages,
  compareFiche,
  compareFicheVie,
  compareSupplementaires,
  ficheVide,
  fichesEgales,
  inscrireResultat,
} from './fiche';

export type Statut = 'C' | 's' | 'X' | ' ';

export interface LigneClassement {
  joueur: number;
  /** Fiche courante (tous les matchs de la ronde) */
  FC: Fiche;
  /** Fiche relative (matchs contre les joueurs à égalité seulement) */
  FR: Fiche;
  /** Fiche à vie (tournois antérieurs) */
  FV: Fiche;
  /** Fiche minimale possible (perd tous les matchs restants) */
  MN: Fiche;
  /** Fiche maximale possible (gagne tous les matchs restants) */
  MX: Fiche;
  /** Rang calculé par les règles */
  rangCalcule: number;
  /** Rang retenu (rang forcé s'il y en a un) */
  rang: number;
  rangForce?: number;
  meilleurRang: number;
  pireRang: number;
  /** C = champion assuré, s = assuré des séries, X = éliminé des séries */
  statut: Statut;
  matchsJoues: number;
  matchsRestants: number;
}

export interface ParamsClassement {
  /** Joueurs de la ronde, dans l'ordre d'inscription (ordre de départ pour les égalités parfaites) */
  joueurs: number[];
  /** Matchs de la ronde (un seul type) */
  matchs: Match[];
  deltaAvantPP: boolean;
  /** Points pour gagner un match de cette ronde (fiche max/min) */
  pointsGagnants: number;
  /** Fiche à vie de chaque joueur (tournois antérieurs) */
  fichesVie?: Map<number, Fiche>;
  rangsForces?: Map<number, number>;
  /** Nombre de qualifiés pour les séries (statut s / X) */
  nbQualifies?: number;
}

interface Resultat {
  pp: number;
  pc: number;
  blanchissage: boolean;
  supplementaire: boolean;
}

/** Tableau des résultats vus par chaque joueur : res.get(a)?.get(b) = match a contre b. */
function tableauResultats(joueurs: number[], matchs: Match[]): Map<number, Map<number, Resultat>> {
  const res = new Map<number, Map<number, Resultat>>();
  for (const j of joueurs) res.set(j, new Map());
  for (const m of matchs) {
    const g = res.get(m.gagnant);
    const p = res.get(m.perdant);
    if (!g || !p) continue;
    // En cas de doublon, le dernier match lu l'emporte (comme le tableau Access)
    g.set(m.perdant, { pp: m.scoreG, pc: m.scoreP, blanchissage: m.blanchissage, supplementaire: m.supplementaire });
    p.set(m.gagnant, { pp: m.scoreP, pc: m.scoreG, blanchissage: m.blanchissage, supplementaire: m.supplementaire });
  }
  return res;
}

function compareGlobale(a: LigneClassement, b: LigneClassement, delta: boolean): number {
  return (
    compareFiche(a.FC, b.FC, delta) ||
    compareFiche(a.FR, b.FR, delta) ||
    compareBlanchissages(a.FC, b.FC) ||
    compareBlanchissages(a.FR, b.FR) ||
    compareSupplementaires(a.FC, b.FC) ||
    compareSupplementaires(a.FR, b.FR) ||
    compareFicheVie(a.FV, b.FV, delta)
  );
}

export function calculerClassement(p: ParamsClassement): LigneClassement[] {
  const { joueurs, deltaAvantPP: delta } = p;
  const res = tableauResultats(joueurs, p.matchs);
  const n = joueurs.length;

  // 1. Fiches courantes
  const lignes: LigneClassement[] = joueurs.map((j) => {
    const FC = ficheVide();
    for (const r of res.get(j)!.values()) {
      if (r.pp !== r.pc) inscrireResultat(FC, r.pp, r.pc, r.blanchissage, r.supplementaire);
    }
    const joues = FC.MG + FC.MP;
    return {
      joueur: j,
      FC,
      FR: ficheVide(),
      FV: p.fichesVie?.get(j) ?? ficheVide(),
      MN: ficheVide(),
      MX: ficheVide(),
      rangCalcule: 0,
      rang: 0,
      meilleurRang: 0,
      pireRang: 0,
      statut: ' ',
      matchsJoues: joues,
      matchsRestants: n - 1 - joues,
    };
  });

  // 2. Fiches relatives : pour chaque groupe à égalité sur la fiche courante,
  //    fiche des matchs joués entre les membres du groupe seulement.
  const groupes = new Map<string, LigneClassement[]>();
  for (const l of lignes) {
    const cle = [l.FC.MG, l.FC.MP, delta ? l.FC.PP - l.FC.PC : 'x', l.FC.PP, l.FC.PC].join('|');
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle)!.push(l);
  }
  for (const g of groupes.values()) {
    if (g.length < 2) continue;
    for (const l of g) {
      for (const autre of g) {
        if (autre === l) continue;
        const r = res.get(l.joueur)!.get(autre.joueur);
        if (r && r.pp !== r.pc) inscrireResultat(l.FR, r.pp, r.pc, r.blanchissage, r.supplementaire);
      }
    }
  }

  // 3. Tri (stable : les égalités parfaites gardent l'ordre d'inscription)
  lignes.sort((a, b) => -compareGlobale(a, b, delta));
  lignes.forEach((l, i) => {
    l.rangCalcule = i + 1;
    const force = p.rangsForces?.get(l.joueur);
    l.rangForce = force || undefined;
    l.rang = force || i + 1;
  });

  // 4. Fiches min / max possibles
  const max = p.pointsGagnants;
  for (const l of lignes) {
    const k = l.matchsRestants;
    const fc = l.FC;
    l.MN = { ...fc, MP: fc.MP + k, PC: fc.PC + max * k, P0: fc.P0 + k };
    if (delta) {
      l.MX = { ...fc, MG: fc.MG + k, PP: fc.PP + max * k, G0: fc.G0 + k };
    } else {
      // Gagne tous ses matchs en supplémentaire (max+1 à max)
      l.MX = { ...fc, MG: fc.MG + k, PP: fc.PP + (max + 1) * k, PC: fc.PC + max * k, GS: fc.GS + k };
    }
  }

  // 5. Meilleur et pire rang possibles
  lignes.forEach((li, i) => {
    let meilleur = 0;
    let pire = 0;
    lignes.forEach((lj, j) => {
      if (i === j) return;
      const jTermine = fichesEgales(lj.MX, lj.MN);
      const r1 = compareFiche(li.MX, lj.MN, delta);
      if (r1 < 0) meilleur++; // j finira sûrement devant i
      else if (r1 === 0 && jTermine && i > j) meilleur++;
      const r2 = compareFiche(li.MN, lj.MX, delta);
      if (r2 < 0) pire++; // j peut finir devant i
      else if (r2 === 0 && jTermine && i > j) pire++;
    });
    li.meilleurRang = meilleur + 1;
    li.pireRang = pire + 1;
    const q = p.nbQualifies ?? 0;
    li.statut = li.pireRang === 1 ? 'C' : li.pireRang <= q ? 's' : li.meilleurRang > q ? 'X' : ' ';
  });

  return lignes.sort((a, b) => a.rang - b.rang || a.rangCalcule - b.rangCalcule);
}
