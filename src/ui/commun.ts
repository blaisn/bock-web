import { nom, nomCourt } from '../calc';
import { h, type Child } from '../dom';
import { cote, type Fiche, pourcentPoints } from '../engine/fiche';
import { signe, trois } from '../format';

export const lienJoueur = (id: number, court = true) => h('a', { href: `#/j/${id}`, class: 'joueur', title: nom(id) }, court ? nomCourt(id) : nom(id));

export const lienTournoi = (id: number, texte: Child) => h('a', { href: `#/t/${id}` }, texte);

/** En-têtes standards d'une fiche */
export const ENTETES_FICHE: [string, string][] = [
  ['MG', 'Matchs gagnés'],
  ['MP', 'Matchs perdus'],
  ['Cote', 'Proportion de matchs gagnés'],
  ['PP', 'Points pour'],
  ['PC', 'Points contre'],
  ['±', 'Différentiel'],
  ['%', 'Proportion des points marqués'],
  ['G0', 'Gagnés par blanchissage'],
  ['P0', 'Perdus par blanchissage'],
  ['GS', 'Gagnés en supplémentaire'],
  ['PS', 'Perdus en supplémentaire'],
];

export const thFiche = () => ENTETES_FICHE.map(([t, titre]) => h('th', { class: 'num', title: titre }, t));

export const tdFiche = (f: Fiche) => [
  h('td', { class: 'num fort' }, f.MG),
  h('td', { class: 'num' }, f.MP),
  h('td', { class: 'num' }, f.MG + f.MP ? trois(cote(f)) : ''),
  h('td', { class: 'num' }, f.PP),
  h('td', { class: 'num' }, f.PC),
  h('td', { class: 'num discret' }, signe(f.PP - f.PC)),
  h('td', { class: 'num' }, f.PP + f.PC ? trois(pourcentPoints(f)) : ''),
  h('td', { class: 'num discret' }, f.G0 || ''),
  h('td', { class: 'num discret' }, f.P0 || ''),
  h('td', { class: 'num discret' }, f.GS || ''),
  h('td', { class: 'num discret' }, f.PS || ''),
];

export const titre = (texte: Child, ...apres: Child[]) => h('div', { class: 'titre-page' }, h('h1', null, texte), apres);

export function champ(libelle: string, controle: HTMLElement, aide?: string) {
  return h('label', { class: 'champ' }, h('span', null, libelle), controle, aide ? h('small', null, aide) : null);
}

/** Tableau triable par clic sur les en-têtes */
export function tableTriable<T>(
  colonnes: { titre: string; aide?: string; num?: boolean; cle?: (x: T) => number | string; rendu: (x: T, i: number) => Child; classe?: string }[],
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
