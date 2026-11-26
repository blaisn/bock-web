// Contraintes d'intégrité (équivalent des clés, index uniques et relations de la base Access)
//
//  Access                                   Ici
//  ---------------------------------------  ------------------------------------------------
//  PK tbl_Joueurs.chp_Joueur                joueurs[].id unique
//  PK tbl_Tournois.chp_Tournoi              tournois[].id unique
//  idx_TournoiJoueur (unique)               participations (tournoi, joueur) unique
//  Participations → Joueurs / Tournois      participations[].joueur / .tournoi existent
//  Matches → Participations (G et P)        (tournoi, gagnant) et (tournoi, perdant) inscrits
//  idx_Unicité                              un seul match par paire de joueurs (ronde)
//  idx_Éliminatoire                         un seul match par position (ronde, idMatch)
//  ValideScore & cie (VBA)                  pointage valide, drapeaux cohérents

import type { BockData, Match } from '../model';
import { TYPES_MATCH } from '../model';
import { estBlanchissage, estSupplementaire, scoreValide } from './regles';

const entierPositif = (x: unknown): x is number => Number.isInteger(x) && (x as number) > 0;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_HEURE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** Groupe d'un match à élimination : la finale appartient au tableau des séries. */
export const groupeElimination = (m: Match) => (m.type === 'Finale' ? 'Séries' : m.type);

/** Le match se joue-t-il dans un tableau à élimination (et non à la ronde) ? */
export function estElimination(data: BockData, m: Match): boolean {
  if (m.type === 'Saison') return false;
  const t = data.tournois.find((x) => x.id === m.tournoi);
  return !(t?.typeSeries === 'ronde' && m.type === 'Séries');
}

/**
 * Retourne la liste des violations (vide = données intègres).
 * Les messages sont destinés à l'utilisateur.
 */
export function verifierIntegrite(data: BockData): string[] {
  const e: string[] = [];
  if (!data || !Array.isArray(data.joueurs) || !Array.isArray(data.tournois) || !Array.isArray(data.participations) || !Array.isArray(data.matchs)) {
    return ['Format invalide : joueurs, tournois, participations et matchs sont requis.'];
  }

  // --- Joueurs
  const joueurs = new Map<number, string>();
  for (const j of data.joueurs) {
    if (!entierPositif(j.id)) e.push(`Joueur « ${j.nom} » : identifiant invalide (${j.id}).`);
    else if (joueurs.has(j.id)) e.push(`Joueur no ${j.id} en double.`);
    if (!j.nom?.trim()) e.push(`Joueur no ${j.id} : nom manquant.`);
    joueurs.set(j.id, j.nomCourt || j.nom);
  }
  const nomJ = (id: number) => joueurs.get(id) ?? `#${id}`;

  // --- Tournois
  const tournois = new Map<number, (typeof data.tournois)[number]>();
  for (const t of data.tournois) {
    if (!entierPositif(t.id)) e.push(`Tournoi « ${t.lieu} » : identifiant invalide (${t.id}).`);
    else if (tournois.has(t.id)) e.push(`Tournoi no ${t.id} en double.`);
    tournois.set(t.id, t);
    if (!DATE.test(t.date ?? '')) e.push(`Tournoi no ${t.id} : date invalide (${t.date}).`);
    if (!t.lieu?.trim()) e.push(`Tournoi no ${t.id} : lieu manquant.`);
    if (!Number.isInteger(t.nbJoueursSeries) || t.nbJoueursSeries < 0) e.push(`Tournoi no ${t.id} : nombre de joueurs en séries invalide.`);
    if (t.typeSeries !== 'elimination' && t.typeSeries !== 'ronde') e.push(`Tournoi no ${t.id} : formule des séries invalide.`);
    for (const k of TYPES_MATCH) if (!entierPositif(t.pointsGagnants?.[k])) e.push(`Tournoi no ${t.id} : points pour gagner (${k}) invalides.`);
    const ci = t.championsInscrits;
    if (ci) for (const [k, v] of Object.entries(ci)) if (v != null && !joueurs.has(v)) e.push(`Tournoi no ${t.id} : champion ${k} inscrit inexistant (#${v}).`);
  }

  // --- Participations
  const inscrits = new Set<string>();
  const nbParTournoi = new Map<number, number>();
  for (const p of data.participations) {
    const cle = `${p.tournoi}-${p.joueur}`;
    if (!tournois.has(p.tournoi)) e.push(`Participation de ${nomJ(p.joueur)} à un tournoi inexistant (no ${p.tournoi}).`);
    if (!joueurs.has(p.joueur)) e.push(`Participation d'un joueur inexistant (#${p.joueur}) au tournoi no ${p.tournoi}.`);
    if (inscrits.has(cle)) e.push(`${nomJ(p.joueur)} est inscrit deux fois au tournoi no ${p.tournoi}.`);
    inscrits.add(cle);
    nbParTournoi.set(p.tournoi, (nbParTournoi.get(p.tournoi) ?? 0) + 1);
    for (const [k, v] of Object.entries(p.rangForce ?? {})) if (v != null && !entierPositif(v)) e.push(`Rang forcé ${k} invalide pour ${nomJ(p.joueur)} (tournoi no ${p.tournoi}).`);
  }
  for (const t of data.tournois) {
    const n = nbParTournoi.get(t.id) ?? 0;
    if (t.nbJoueursSeries > n) e.push(`Tournoi no ${t.id} : ${t.nbJoueursSeries} joueurs en séries pour ${n} participants.`);
  }

  // --- Matchs
  const paires = new Set<string>();
  const positions = new Set<string>();
  for (const m of data.matchs) {
    const t = tournois.get(m.tournoi);
    const desc = `Match ${nomJ(m.gagnant)} c. ${nomJ(m.perdant)} (${m.type}, tournoi no ${m.tournoi})`;
    if (!t) {
      e.push(`${desc} : tournoi inexistant.`);
      continue;
    }
    if (!TYPES_MATCH.includes(m.type)) {
      e.push(`${desc} : type inconnu.`);
      continue;
    }
    if (m.gagnant === m.perdant) e.push(`${desc} : un joueur ne peut pas jouer contre lui-même.`);
    for (const j of [m.gagnant, m.perdant]) if (!inscrits.has(`${m.tournoi}-${j}`)) e.push(`${desc} : ${nomJ(j)} n'est pas inscrit à ce tournoi.`);
    const max = t.pointsGagnants[m.type];
    if (!scoreValide(max, m.scoreG, m.scoreP) || m.scoreG <= m.scoreP) e.push(`${desc} : pointage ${m.scoreG}-${m.scoreP} invalide (match à ${max} points).`);
    else {
      if (m.blanchissage !== estBlanchissage(max, m.scoreG, m.scoreP)) e.push(`${desc} : indicateur de blanchissage incohérent.`);
      if (m.supplementaire !== estSupplementaire(max, m.scoreG, m.scoreP)) e.push(`${desc} : indicateur de supplémentaire incohérent.`);
    }
    if (m.dateHeure && !DATE_HEURE.test(m.dateHeure)) e.push(`${desc} : date-heure invalide.`);

    if (estElimination(data, m)) {
      if (!entierPositif(m.ronde) || !entierPositif(m.idMatch)) e.push(`${desc} : position dans le tableau manquante.`);
      else {
        const cle = `${m.tournoi}-${groupeElimination(m)}-${m.ronde}-${m.idMatch}`;
        if (positions.has(cle)) e.push(`${desc} : deux matchs à la même position (ronde ${m.ronde}, match ${m.idMatch}).`);
        positions.add(cle);
      }
    } else {
      const cle = `${m.tournoi}-${m.type}-${Math.min(m.gagnant, m.perdant)}-${Math.max(m.gagnant, m.perdant)}`;
      if (paires.has(cle)) e.push(`${desc} : ces deux joueurs ont déjà un match.`);
      paires.add(cle);
    }
  }
  return e;
}

// ---------- Règles de suppression ----------

export const matchsDuJoueur = (data: BockData, joueur: number, tournoi?: number) =>
  data.matchs.filter((m) => (m.gagnant === joueur || m.perdant === joueur) && (tournoi === undefined || m.tournoi === tournoi));

export const matchsDuTournoi = (data: BockData, tournoi: number) => data.matchs.filter((m) => m.tournoi === tournoi);

/**
 * Raison pour laquelle un match ne peut pas être supprimé ou modifié,
 * ou undefined s'il le peut : dans un tableau à élimination, le match de la
 * ronde suivante où se retrouve le vainqueur ne doit pas être joué.
 */
export function blocageMatch(data: BockData, m: Match): string | undefined {
  if (!estElimination(data, m) || !m.ronde || !m.idMatch) return undefined;
  const groupe = groupeElimination(m);
  const suivant = data.matchs.find(
    (x) =>
      x.tournoi === m.tournoi &&
      estElimination(data, x) &&
      groupeElimination(x) === groupe &&
      x.ronde === m.ronde! + 1 &&
      (x.idMatch === Math.ceil(m.idMatch! / 2) || x.gagnant === m.gagnant || x.perdant === m.gagnant),
  );
  return suivant ? 'Le match suivant de ce tableau est déjà joué : supprimez-le d’abord.' : undefined;
}
