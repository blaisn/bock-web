// Graphiques en pointes de tarte (SVG, sans librairie)
import { h, type Child } from '../dom';
import type { Fiche } from '../engine/fiche';

export interface Tranche {
  libelle: string;
  valeur: number;
  couleur: string;
}

/**
 * Palette validée (scripts dataviz : bande de luminosité, chroma, séparation
 * daltonisme ΔE ≥ 15 entre tons voisins) sur le fond crème du site.
 * Les tons pâles ont un contraste < 3:1 : la légende affiche donc toujours les valeurs.
 */
export const VERTS = ['#166437', '#409a62', '#80cb94'];
export const ROUGES = ['#8a2a1c', '#c8573f', '#ef9884'];

const SVGNS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...enfants: Node[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...enfants);
  return el;
}

const pourcent = (v: number, total: number) => (total ? `${((v / total) * 100).toFixed(1).replace('.', ',')} %` : '');

/** Tarte avec légende (valeurs et pourcentages) ; survol d'une pointe ou d'une ligne = mise en évidence. */
export function tarte(titre: string, sousTitre: string, tranches: Tranche[], note?: string): Child {
  const total = tranches.reduce((s, t) => s + t.valeur, 0);
  const R = 90;
  const C = 100;
  const groupe = svg('g', {});
  const elements: { pointe?: SVGElement; ligne: HTMLElement }[] = [];

  let angle = -Math.PI / 2;
  const point = (a: number, r = R) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  for (const t of tranches) {
    let pointe: SVGElement | undefined;
    if (t.valeur > 0 && total > 0) {
      const ouverture = (t.valeur / total) * 2 * Math.PI;
      const fin = angle + ouverture;
      const d =
        t.valeur === total
          ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
          : `M ${C} ${C} L ${point(angle)} A ${R} ${R} 0 ${ouverture > Math.PI ? 1 : 0} 1 ${point(fin)} Z`;
      // Décalage vers l'extérieur au survol, le long de la bissectrice
      const milieu = angle + ouverture / 2;
      pointe = svg('path', { d, fill: t.couleur, class: 'pointe', style: `--dx:${(Math.cos(milieu) * 5).toFixed(2)}px;--dy:${(Math.sin(milieu) * 5).toFixed(2)}px` }, svg('title', {}, document.createTextNode(`${t.libelle} : ${t.valeur} (${pourcent(t.valeur, total)})`)));
      groupe.append(pointe);
      angle = fin;
    }
    const ligne = h(
      'li',
      { class: t.valeur ? '' : 'nul' },
      h('span', { class: 'pastille-couleur', style: { background: t.couleur } }),
      h('span', { class: 'legende-libelle' }, t.libelle),
      h('span', { class: 'legende-valeur' }, t.valeur),
      h('span', { class: 'legende-pct' }, pourcent(t.valeur, total)),
    );
    elements.push({ pointe, ligne });
  }

  const graphique = svg('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': `${titre} : ${tranches.map((t) => `${t.libelle} ${t.valeur}`).join(', ')}` }, groupe);
  const conteneur = h('figure', { class: 'carte-graphique' }, h('figcaption', null, h('b', null, titre), h('small', null, sousTitre)));
  for (const { pointe, ligne } of elements) {
    const activer = (oui: boolean) => {
      conteneur.classList.toggle('survol', oui);
      pointe?.classList.toggle('active', oui);
      ligne.classList.toggle('active', oui);
    };
    for (const el of [pointe, ligne]) {
      el?.addEventListener('mouseenter', () => activer(true));
      el?.addEventListener('mouseleave', () => activer(false));
    }
  }
  conteneur.append(h('div', { class: 'graphique-corps' }, graphique, h('ul', { class: 'legende-graphique' }, elements.map((e) => e.ligne))));
  if (note) conteneur.append(h('p', { class: 'note-graphique' }, note));
  return conteneur;
}

/** Les deux graphiques de la fiche du joueur, à partir de la fiche à vie (total). */
export function graphiquesFiche(f: Fiche): Child {
  const mj = f.MG + f.MP;
  return h(
    'div',
    { class: 'graphiques' },
    tarte('Matchs', `${mj} matchs joués`, [
      // Tranches disjointes : un blanchissage ou un supplémentaire est aussi une victoire ou une défaite
      { libelle: 'Victoires (autres)', valeur: f.MG - f.G0 - f.GS, couleur: VERTS[0] },
      { libelle: 'Victoires par blanchissage', valeur: f.G0, couleur: VERTS[1] },
      { libelle: 'Victoires en supplémentaire', valeur: f.GS, couleur: VERTS[2] },
      { libelle: 'Défaites (autres)', valeur: f.MP - f.P0 - f.PS, couleur: ROUGES[0] },
      { libelle: 'Défaites par blanchissage', valeur: f.P0, couleur: ROUGES[1] },
      { libelle: 'Défaites en supplémentaire', valeur: f.PS, couleur: ROUGES[2] },
    ], 'Pointes distinctes : les victoires et défaites « autres » excluent les blanchissages et les supplémentaires (MG = autres + G0 + GS).'),
    tarte('Points', `${f.PP + f.PC} points marqués`, [
      { libelle: 'Points pour', valeur: f.PP, couleur: VERTS[0] },
      { libelle: 'Points contre', valeur: f.PC, couleur: ROUGES[0] },
    ]),
  );
}
