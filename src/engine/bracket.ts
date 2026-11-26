// Séries et consolation à élimination directe (port de bas_Éliminatoire)

import type { Match, TypeMatch } from '../model';

/** Prochaine puissance de 2 ≥ n (minimum 2), comme ProchainePuissancede2. */
export function prochainePuissanceDe2(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

/**
 * Ordre de placement en première ronde pour un tableau de taille p (puissance de 2).
 * 8 → [1,8,4,5,2,7,3,6] : match 1 = 1 c. 8, match 2 = 4 c. 5, match 3 = 2 c. 7, match 4 = 3 c. 6.
 */
export function ordrePlacement(p: number): number[] {
  let ordre = [1, 2];
  while (ordre.length < p) {
    const taille = ordre.length * 2;
    ordre = ordre.flatMap((s) => [s, taille + 1 - s]);
  }
  return ordre;
}

export type Case =
  | { etat: 'joueur'; joueur: number; tete?: number }
  | { etat: 'vide' } // personne ne viendra (laissez-passer)
  | { etat: 'attente' }; // vainqueur d'un match pas encore joué

export interface MatchTableau {
  ronde: number;
  idMatch: number;
  type: TypeMatch;
  haut: Case;
  bas: Case;
  /** Match enregistré, s'il y a lieu */
  match?: Match;
  /** Vainqueur (match joué ou laissez-passer) */
  vainqueur?: number;
  laissezPasser: boolean;
}

export interface Tableau {
  type: 'Séries' | 'Consolation';
  taille: number;
  nbRondes: number;
  /** rondes[r-1][j-1] */
  rondes: MatchTableau[][];
  champion?: number;
}

/**
 * @param type 'Séries' ou 'Consolation'
 * @param tetes joueurs dans l'ordre de classement (tête de série 1 en premier)
 * @param matchs matchs du tournoi de ce type (+ 'Finale' pour les séries)
 */
export function construireTableau(type: 'Séries' | 'Consolation', tetes: number[], matchs: Match[]): Tableau {
  const taille = prochainePuissanceDe2(tetes.length);
  const nbRondes = Math.round(Math.log2(taille));
  const ordre = ordrePlacement(taille);
  const enregistres = new Map<string, Match>();
  for (const m of matchs) {
    const t = m.type === 'Finale' ? 'Séries' : m.type;
    if (t !== type || !m.ronde || !m.idMatch) continue;
    enregistres.set(`${m.ronde}-${m.idMatch}`, m);
  }

  const caseTete = (rangRelatif: number): Case =>
    rangRelatif <= tetes.length ? { etat: 'joueur', joueur: tetes[rangRelatif - 1], tete: rangRelatif } : { etat: 'vide' };

  const utilises = new Set<Match>();
  const rondes: MatchTableau[][] = [];
  let precedents: Case[] = ordre.map(caseTete);
  for (let r = 1; r <= nbRondes; r++) {
    const ronde: MatchTableau[] = [];
    const vainqueurs: Case[] = [];
    for (let j = 1; j <= precedents.length / 2; j++) {
      let haut = precedents[2 * j - 2];
      let bas = precedents[2 * j - 1];
      const typeMatch: TypeMatch = type === 'Séries' && r === nbRondes ? 'Finale' : type;
      let m = enregistres.get(`${r}-${j}`);
      if (!m && haut.etat === 'joueur' && bas.etat === 'joueur') {
        // Match historique enregistré à une autre position : on le reconnaît par ses joueurs
        const paire = [haut.joueur, bas.joueur];
        m = [...enregistres.values()].find((x) => !utilises.has(x) && paire.includes(x.gagnant) && paire.includes(x.perdant));
      }
      if (m) utilises.add(m);
      const mt: MatchTableau = { ronde: r, idMatch: j, type: typeMatch, haut, bas, laissezPasser: false };
      if (m) {
        mt.match = m;
        // Le match enregistré fait foi : on corrige les cases au besoin
        const joueursCases = [haut, bas].map((c) => (c.etat === 'joueur' ? c.joueur : undefined));
        if (!joueursCases.includes(m.gagnant) || !joueursCases.includes(m.perdant)) {
          const autre = (x: number, c: Case): Case =>
            c.etat === 'joueur' && c.joueur === x ? c : { etat: 'joueur', joueur: x };
          if (joueursCases[1] === m.gagnant || joueursCases[0] === m.perdant) {
            haut = autre(m.perdant, haut);
            bas = autre(m.gagnant, bas);
          } else {
            haut = autre(m.gagnant, haut);
            bas = autre(m.perdant, bas);
          }
          mt.haut = haut;
          mt.bas = bas;
        }
        mt.vainqueur = m.gagnant;
        vainqueurs.push(m.gagnant === (haut as { joueur?: number }).joueur ? haut : bas);
      } else if (haut.etat === 'joueur' && bas.etat === 'vide') {
        mt.vainqueur = haut.joueur;
        mt.laissezPasser = true;
        vainqueurs.push(haut);
      } else if (bas.etat === 'joueur' && haut.etat === 'vide') {
        mt.vainqueur = bas.joueur;
        mt.laissezPasser = true;
        vainqueurs.push(bas);
      } else if (haut.etat === 'vide' && bas.etat === 'vide') {
        mt.laissezPasser = true;
        vainqueurs.push({ etat: 'vide' });
      } else {
        vainqueurs.push({ etat: 'attente' });
      }
      ronde.push(mt);
    }
    rondes.push(ronde);
    precedents = vainqueurs;
  }
  const finale = rondes[nbRondes - 1][0];
  return { type, taille, nbRondes, rondes, champion: finale.vainqueur };
}

/** Rang final dans un tableau : 1 = champion, 2 = finaliste, 3 = demi-finalistes, etc. */
export function rangsTableau(t: Tableau): Map<number, number> {
  const rangs = new Map<number, number>();
  for (let r = t.nbRondes; r >= 1; r--) {
    for (const m of t.rondes[r - 1]) {
      for (const c of [m.haut, m.bas]) {
        if (c.etat !== 'joueur' || rangs.has(c.joueur)) continue;
        if (m.vainqueur === undefined) continue;
        if (c.joueur === m.vainqueur) {
          if (r === t.nbRondes) rangs.set(c.joueur, 1);
        } else {
          rangs.set(c.joueur, 2 ** (t.nbRondes - r) + 1);
        }
      }
    }
  }
  return rangs;
}
