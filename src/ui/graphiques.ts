// Graphiques en pointes de tarte (SVG, sans librairie)
import { h, type Child } from '../dom';
import { type EtapeParcours, HORS_SERIES, NIVEAUX_SERIES } from '../calc';
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

// ---------- Évolution d'un joueur sur l'ensemble des tournois ----------

const ordinal = (r: number) => (r === 1 ? '1er' : `${r}e`);

/**
 * Deux panneaux partageant l'axe des tournois :
 *  - Saison : rang normalisé (points) et moyenne mobile sur 3 participations (ligne), ★ = champion
 *  - Séries : niveau atteint, en escalier ; 🏆 = champion des séries, 🚽 = champion de la consolation
 */
export function graphiqueEvolution(etapes: EtapeParcours[]): Child {
  const n = etapes.length;
  const G = 92; // marge gauche (libellés)
  const D = 14;
  const pas = Math.max(18, Math.min(28, 720 / n));
  const L = G + D + pas * n;
  const hA = 170; // panneau saison
  const yA0 = 28;
  const ecart = 34;
  const avec16 = etapes.some((e) => e.niveauSeries === 4);
  const niveaux = NIVEAUX_SERIES.map((lib, i) => ({ lib, i })).filter((x) => x.i !== 4 || avec16);
  const hB = (niveaux.length - 1) * 22;
  const yB0 = yA0 + hA + ecart;
  const H = yB0 + hB + 34;
  const x = (i: number) => G + (i + 0.5) * pas;
  const yA = (norm: number) => yA0 + ((100 - norm) / 100) * hA;
  const rangNiveau = (niv: number) => niveaux.findIndex((v) => v.i === niv);
  const yB = (niv: number) => yB0 + (rangNiveau(niv) / (niveaux.length - 1)) * hB;

  const racine = svg('svg', { viewBox: `0 0 ${L} ${H}`, width: L, height: H, class: 'evolution', role: 'img', 'aria-label': 'Évolution du rang de saison et du résultat en séries, tournoi par tournoi' });
  const txt = (xx: number, yy: number, t: string, attrs: Record<string, string | number> = {}) => svg('text', { x: xx, y: yy, ...attrs }, document.createTextNode(t));

  // Titres des panneaux
  racine.append(txt(0, yA0 - 12, 'Saison', { class: 'ev-titre' }), txt(0, yB0 - 12, 'Séries', { class: 'ev-titre' }));

  // Grille et libellés — panneau saison
  for (const [v, lib] of [
    [100, '1er'],
    [50, 'milieu'],
    [0, 'dernier'],
  ] as [number, string][]) {
    racine.append(svg('line', { x1: G, x2: L - D, y1: yA(v), y2: yA(v), class: 'ev-grille' }), txt(G - 8, yA(v) + 4, lib, { class: 'ev-axe', 'text-anchor': 'end' }));
  }
  for (const v of [25, 75]) racine.append(svg('line', { x1: G, x2: L - D, y1: yA(v), y2: yA(v), class: 'ev-grille fine' }));
  // Grille et libellés — panneau séries
  for (const { lib, i } of niveaux) {
    racine.append(svg('line', { x1: G, x2: L - D, y1: yB(i), y2: yB(i), class: 'ev-grille' }), txt(G - 8, yB(i) + 4, lib === 'Quart de finale' ? 'Quart' : lib === 'Huitième de finale' ? 'Huitième' : lib === 'Demi-finale' ? 'Demi' : lib, { class: 'ev-axe', 'text-anchor': 'end' }));
  }
  // Années (axe du bas) : une étiquette environ tous les 5 ans
  let derniere = -99;
  etapes.forEach((e, i) => {
    const an = Number(e.tournoi.date.slice(0, 4));
    if (i === 0 || i === n - 1 || an - derniere >= 5) {
      if (i !== n - 1 && n - 1 - i < 3 && i !== 0) return;
      racine.append(txt(x(i), H - 10, String(an), { class: 'ev-axe', 'text-anchor': 'middle' }));
      derniere = an;
    }
  });

  // Moyenne mobile (3 dernières participations), segments pointillés à travers les absences
  const presents = etapes.map((e, i) => ({ e, i })).filter((p) => p.e.present && p.e.norm !== undefined);
  const moyennes = presents.map((p, k) => {
    const fen = presents.slice(Math.max(0, k - 2), k + 1);
    return { i: p.i, v: fen.reduce((s, q) => s + q.e.norm!, 0) / fen.length };
  });
  for (let k = 1; k < moyennes.length; k++) {
    const a = moyennes[k - 1];
    const b = moyennes[k];
    racine.append(svg('line', { x1: x(a.i), y1: yA(a.v), x2: x(b.i), y2: yA(b.v), class: `ev-moyenne ${b.i - a.i > 1 ? 'absence' : ''}` }));
  }
  // Points du rang de saison
  for (const { e, i } of presents) {
    racine.append(svg('circle', { cx: x(i), cy: yA(e.norm!), r: 3.6, class: 'ev-point' }));
    if (e.champSaison) racine.append(txt(x(i), yA(e.norm!) - 8, '★', { class: 'ev-etoile', 'text-anchor': 'middle' }));
  }

  // Escalier des séries
  const avecNiveau = presents.filter((p) => p.e.niveauSeries !== undefined);
  let precedent: { i: number; y: number } | undefined;
  for (const { e, i } of avecNiveau) {
    const yy = yB(e.niveauSeries!);
    const x1 = x(i) - pas / 2 + 2;
    const x2 = x(i) + pas / 2 - 2;
    if (precedent) racine.append(svg('path', { d: `M ${x(precedent.i) + pas / 2 - 2} ${precedent.y} L ${x1} ${yy}`, class: `ev-marche lien ${i - precedent.i > 1 ? 'absence' : ''}` }));
    racine.append(svg('line', { x1, x2, y1: yy, y2: yy, class: `ev-marche ${e.niveauSeries === HORS_SERIES ? 'hors' : ''}` }));
    if (e.champSeries) racine.append(txt(x(i), yy - 6, '🏆', { class: 'ev-icone', 'text-anchor': 'middle' }));
    if (e.champConsolation) racine.append(svg('image', { href: 'toilette.png', x: x(i) - 5, y: yy - 21, width: 10, height: 17 }));
    precedent = { i, y: yy };
  }

  // Couche de survol : une colonne par tournoi, ligne verticale + infobulle
  const repere = svg('line', { x1: 0, x2: 0, y1: yA0 - 6, y2: yB0 + hB + 6, class: 'ev-repere' });
  racine.append(repere);
  const bulle = h('div', { class: 'ev-bulle', role: 'status' });
  const conteneur = h('figure', { class: 'carte-graphique evolution-carte' });
  etapes.forEach((e, i) => {
    const zone = svg('rect', { x: x(i) - pas / 2, y: yA0 - 10, width: pas, height: yB0 + hB - yA0 + 20, class: 'ev-zone' });
    zone.addEventListener('mouseenter', () => {
      repere.setAttribute('x1', String(x(i)));
      repere.setAttribute('x2', String(x(i)));
      repere.classList.add('visible');
      const t = e.tournoi;
      const lignes: Child[] = [h('b', null, `${t.date.slice(0, 4)} · ${t.lieu}`)];
      if (!e.present) lignes.push(h('span', null, 'Absent'));
      else {
        lignes.push(h('span', null, `Saison : ${ordinal(e.rang!)} sur ${e.nbParticipants}${e.champSaison ? ' ★' : ''}`));
        if (e.niveauSeries !== undefined) lignes.push(h('span', null, e.niveauSeries === HORS_SERIES ? 'Séries : non qualifié' : `Séries : ${NIVEAUX_SERIES[e.niveauSeries].toLowerCase()}${e.champSeries ? ' 🏆' : ''}`));
        if (e.champConsolation) lignes.push(h('span', null, 'Champion de la consolation 🚽'));
      }
      bulle.replaceChildren(...lignes.map((l) => h('div', null, l)));
      const boite = racine.getBoundingClientRect();
      const cadre = (bulle.parentElement as HTMLElement).getBoundingClientRect();
      const gauche = boite.left - cadre.left + x(i) * (boite.width / L);
      // À droite du repère, ou à gauche s'il n'y a pas la place
      const aGauche = gauche > cadre.width - 230;
      bulle.style.left = `${aGauche ? gauche - 12 : gauche + 12}px`;
      bulle.classList.toggle('a-gauche', aGauche);
      bulle.classList.add('visible');
    });
    zone.addEventListener('mouseleave', () => {
      repere.classList.remove('visible');
      bulle.classList.remove('visible');
    });
    zone.addEventListener('click', () => (location.hash = `#/t/${e.tournoi.id}`));
    racine.append(zone);
  });

  conteneur.append(
    h('figcaption', null, h('b', null, 'Évolution'), h('small', null, 'rang de saison (points) et moyenne des 3 dernières participations (ligne) · résultat en séries (escalier)')),
    h('div', { class: 'ev-cadre' }, h('div', { class: 'defile-graphique' }, racine), bulle),
  );
  return conteneur;
}
