// Calculs mémorisés pour l'interface + statistiques à vie
import type { TypeMatch } from './model';
import { rangsTableau, type Tableau } from './engine/bracket';
import type { LigneClassement } from './engine/classement';
import { type Fiche, ficheVide, inscrireResultat } from './engine/fiche';
import { type Champions, championsTournoi, classementRonde, tableauTournoi } from './engine/tournoi';
import { memo, store } from './store';

export const classement = (id: number, type: 'Saison' | 'Séries' = 'Saison'): LigneClassement[] =>
  memo(`cl-${id}-${type}`, () => classementRonde(store.data, id, type));

export const tableau = (id: number, type: 'Séries' | 'Consolation'): Tableau | null =>
  memo(`tab-${id}-${type}`, () => tableauTournoi(store.data, id, type));

export const champions = (id: number): Champions => memo(`ch-${id}`, () => championsTournoi(store.data, id));

export function joueur(id: number) {
  return store.data.joueurs.find((j) => j.id === id);
}

export function nomCourt(id?: number): string {
  if (id === undefined) return '';
  return joueur(id)?.nomCourt || joueur(id)?.nom || `#${id}`;
}

export function nom(id?: number): string {
  if (id === undefined) return '';
  return joueur(id)?.nom || `#${id}`;
}

export const tournoisRecentsDabord = () => [...store.data.tournois].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

export interface StatsVie {
  joueur: number;
  fiche: Fiche;
  participations: number;
  /** Rang moyen normalisé sur 10 (rang / nb participants × 10) */
  rangMoyen: number;
  titresSaison: number;
  titresSeries: number;
  titresConsolation: number;
}

export interface FiltreVie {
  types: TypeMatch[];
  /** Tournois inclus (ids). Vide = tous */
  tournois?: number[];
}

export function statsVie(f: FiltreVie): StatsVie[] {
  return memo(`vie-${f.types.join()}-${f.tournois?.join() ?? '*'}`, () => {
    const inclus = new Set(f.tournois?.length ? f.tournois : store.data.tournois.map((t) => t.id));
    const parJoueur = new Map<number, StatsVie & { sommeRatio: number }>();
    const s = (j: number) => {
      if (!parJoueur.has(j))
        parJoueur.set(j, { joueur: j, fiche: ficheVide(), participations: 0, rangMoyen: 0, titresSaison: 0, titresSeries: 0, titresConsolation: 0, sommeRatio: 0 });
      return parJoueur.get(j)!;
    };
    for (const m of store.data.matchs) {
      if (!inclus.has(m.tournoi) || !f.types.includes(m.type)) continue;
      inscrireResultat(s(m.gagnant).fiche, m.scoreG, m.scoreP, m.blanchissage, m.supplementaire);
      inscrireResultat(s(m.perdant).fiche, m.scoreP, m.scoreG, m.blanchissage, m.supplementaire);
    }
    for (const t of store.data.tournois) {
      if (!inclus.has(t.id)) continue;
      const cl = classement(t.id);
      for (const l of cl) {
        const x = s(l.joueur);
        x.participations++;
        x.sommeRatio += l.rang / cl.length;
      }
      const c = champions(t.id);
      if (c.saison) s(c.saison).titresSaison++;
      if (c.series) s(c.series).titresSeries++;
      if (c.consolation) s(c.consolation).titresConsolation++;
    }
    return [...parJoueur.values()].map(({ sommeRatio, ...x }) => ({ ...x, rangMoyen: x.participations ? (sommeRatio / x.participations) * 10 : 0 }));
  });
}

export interface FaceAFace {
  adversaire: number;
  fiche: Fiche;
}

export function faceAFace(j: number, types: TypeMatch[]): FaceAFace[] {
  return memo(`faf-${j}-${types.join()}`, () => {
    const res = new Map<number, Fiche>();
    const f = (a: number) => {
      if (!res.has(a)) res.set(a, ficheVide());
      return res.get(a)!;
    };
    for (const m of store.data.matchs) {
      if (!types.includes(m.type)) continue;
      if (m.gagnant === j) inscrireResultat(f(m.perdant), m.scoreG, m.scoreP, m.blanchissage, m.supplementaire);
      else if (m.perdant === j) inscrireResultat(f(m.gagnant), m.scoreP, m.scoreG, m.blanchissage, m.supplementaire);
    }
    return [...res.entries()].map(([adversaire, fiche]) => ({ adversaire, fiche }));
  });
}

export interface LigneHistorique {
  tournoi: number;
  rangSaison: number;
  nbParticipants: number;
  saison: LigneClassement;
  /** Rang atteint en séries / consolation (1 = champion, 2 = finaliste, 3 = demi...) */
  rangSeries?: number;
  rangConsolation?: number;
}

export function historiqueJoueur(j: number): LigneHistorique[] {
  return memo(`hist-${j}`, () => {
    const lignes: LigneHistorique[] = [];
    for (const t of tournoisRecentsDabord()) {
      const cl = classement(t.id);
      const l = cl.find((x) => x.joueur === j);
      if (!l) continue;
      const ts = tableau(t.id, 'Séries');
      const tc = tableau(t.id, 'Consolation');
      lignes.push({
        tournoi: t.id,
        rangSaison: l.rang,
        nbParticipants: cl.length,
        saison: l,
        rangSeries: ts ? rangsTableau(ts).get(j) : undefined,
        rangConsolation: tc ? rangsTableau(tc).get(j) : undefined,
      });
    }
    return lignes;
  });
}
