import { nom, nomCourt } from '../calc';
import { h, type Child } from '../dom';
import { cote, type Fiche, pourcentPoints } from '../engine/fiche';
import { signe, trois } from '../format';

export const lienJoueur = (id: number, court = true) => h('a', { href: `#/j/${id}`, class: 'joueur', title: nom(id) }, court ? nomCourt(id) : nom(id));

/** Icône de la consolation (★ = saison, 🏆 = séries) */
export const iconeConsolation = (titre = 'Consolation') => h('img', { src: 'toilette.png', alt: '🚽', title: titre, class: 'icone-toilette' });

export const lienTournoi = (id: number, texte: Child) => h('a', { href: `#/t/${id}` }, texte);

/**
 * Colonnes d'une fiche, dans l'ordre de référence (celui du classement à vie) :
 * Cote, %, MJ, MG, MP, PP, PC, ±, G0, P0, GS, PS.
 * Toutes les vues (classement, fiche du joueur, face-à-face, à vie) utilisent cette liste.
 */
export interface ColonneFiche {
  titre: string;
  aide: string;
  valeur: (f: Fiche) => number;
  rendu: (f: Fiche) => Child;
  classe?: string;
}

const matchsJoues = (f: Fiche) => f.MG + f.MP;

export const COLONNES_FICHE: ColonneFiche[] = [
  { titre: 'Cote', aide: 'Proportion de matchs gagnés', valeur: cote, rendu: (f) => (matchsJoues(f) ? trois(cote(f)) : ''), classe: 'fort' },
  { titre: '%', aide: 'Proportion des points marqués', valeur: pourcentPoints, rendu: (f) => (f.PP + f.PC ? trois(pourcentPoints(f)) : '') },
  { titre: 'MJ', aide: 'Matchs joués', valeur: matchsJoues, rendu: matchsJoues },
  { titre: 'MG', aide: 'Matchs gagnés', valeur: (f) => f.MG, rendu: (f) => f.MG },
  { titre: 'MP', aide: 'Matchs perdus', valeur: (f) => f.MP, rendu: (f) => f.MP },
  { titre: 'PP', aide: 'Points pour', valeur: (f) => f.PP, rendu: (f) => f.PP },
  { titre: 'PC', aide: 'Points contre', valeur: (f) => f.PC, rendu: (f) => f.PC },
  { titre: '±', aide: 'Différentiel (PP − PC)', valeur: (f) => f.PP - f.PC, rendu: (f) => signe(f.PP - f.PC) },
  { titre: 'G0', aide: 'Gagnés par blanchissage', valeur: (f) => f.G0, rendu: (f) => f.G0 || '', classe: 'discret' },
  { titre: 'P0', aide: 'Perdus par blanchissage', valeur: (f) => f.P0, rendu: (f) => f.P0 || '', classe: 'discret' },
  { titre: 'GS', aide: 'Gagnés en supplémentaire', valeur: (f) => f.GS, rendu: (f) => f.GS || '', classe: 'discret' },
  { titre: 'PS', aide: 'Perdus en supplémentaire', valeur: (f) => f.PS, rendu: (f) => f.PS || '', classe: 'discret' },
];

export const thFiche = () => COLONNES_FICHE.map((c) => h('th', { class: 'num', title: c.aide }, c.titre));

export const tdFiche = (f: Fiche) => COLONNES_FICHE.map((c) => h('td', { class: `num ${c.classe ?? ''}` }, c.rendu(f)));

/** Colonnes de fiche pour tableTriable */
export const colonnesFiche = <T>(fiche: (x: T) => Fiche): Colonne<T>[] =>
  COLONNES_FICHE.map((c) => ({ titre: c.titre, aide: c.aide, num: true, classe: c.classe, cle: (x: T) => c.valeur(fiche(x)), rendu: (x: T) => c.rendu(fiche(x)) }));

/** Titres dans l'ordre du déroulement du tournoi : saison, séries, consolation */
export interface Titres {
  titresSaison: number;
  titresSeries: number;
  titresConsolation: number;
}
export const colonnesTitres = <T>(t: (x: T) => Titres | undefined): Colonne<T>[] => [
  { titre: '★', aide: 'Championnats de saison', num: true, cle: (x) => t(x)?.titresSaison ?? 0, rendu: (x) => t(x)?.titresSaison || '' },
  { titre: '🏆', aide: 'Championnats des séries', num: true, cle: (x) => t(x)?.titresSeries ?? 0, rendu: (x) => t(x)?.titresSeries || '' },
  { titre: iconeConsolation(), aide: 'Championnats de consolation', num: true, cle: (x) => t(x)?.titresConsolation ?? 0, rendu: (x) => t(x)?.titresConsolation || '' },
];

export const titre = (texte: Child, ...apres: Child[]) => h('div', { class: 'titre-page' }, h('h1', null, texte), apres);

export function champ(libelle: string, controle: HTMLElement, aide?: string) {
  return h('label', { class: 'champ' }, h('span', null, libelle), controle, aide ? h('small', null, aide) : null);
}

/** Tableau triable par clic sur les en-têtes */
export interface Colonne<T> {
  titre: Child;
  aide?: string;
  num?: boolean;
  cle?: (x: T) => number | string;
  rendu: (x: T, i: number) => Child;
  classe?: string;
}

export function tableTriable<T>(
  colonnes: Colonne<T>[],
  lignes: T[],
  triInitial?: { col: number; desc: boolean },
): HTMLElement {
  let tri = triInitial;
  const tbody = h('tbody');
  const ths = colonnes.map((c, i) =>
    h(
      'th',
      {
        class: [c.num ? 'num' : '', c.cle ? 'triable' : ''].join(' '),
        title: c.aide,
        onclick: () => {
          if (!c.cle) return;
          tri = tri?.col === i ? { col: i, desc: !tri.desc } : { col: i, desc: Boolean(c.num) };
          rendre();
        },
      },
      c.titre,
    ),
  );
  const rendre = () => {
    let l = lignes;
    if (tri && colonnes[tri.col].cle) {
      const k = colonnes[tri.col].cle!;
      const d = tri.desc ? -1 : 1;
      l = [...lignes].sort((a, b) => {
        const x = k(a);
        const y = k(b);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr')) * d;
      });
    }
    ths.forEach((th, i) => th.classList.toggle('trie', tri?.col === i));
    tbody.replaceChildren(...l.map((x, i) => h('tr', null, colonnes.map((c) => h('td', { class: [c.num ? 'num' : '', c.classe ?? ''].join(' ') }, c.rendu(x, i)))))) ;
  };
  rendre();
  return h('div', { class: 'defile' }, h('table', { class: 'donnees' }, h('thead', null, h('tr', null, ths)), tbody));
}
