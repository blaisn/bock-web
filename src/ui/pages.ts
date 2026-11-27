// Pages : tournois, joueurs, fiche d'un joueur, classement à vie, face-à-face, matchs
import { champions, classement, faceAFace, type FaceAFace, historiqueJoueur, joueur, nom, nomCourt, statsVie, type StatsVie, tournoisRecentsDabord } from '../calc';
import { avis, h, modale, type Child } from '../dom';
import { blocageMatch } from '../engine/integrite';
import { cote, type Fiche, ficheVide, pourcentPoints } from '../engine/fiche';
import { annee, dateCourte, heure } from '../format';
import type { Joueur, Match, TypeMatch } from '../model';

/** Même match (comparaison par contenu : les objets sont copiés à chaque transaction) */
const memeMatch = (p: Match, q: Match) =>
  p.tournoi === q.tournoi && p.type === q.type && p.gagnant === q.gagnant && p.perdant === q.perdant && p.ronde === q.ronde && p.idMatch === q.idMatch;
import { store } from '../store';
import { type Colonne, colonnesFiche, colonnesTitres, iconeConsolation, lienJoueur, lienTournoi, tableTriable, tdFiche, thFiche, titre } from './commun';
import { editerJoueur, nouveauTournoi } from './edition';
import { graphiquesFiche } from './graphiques';

// ---------- Tournois ----------

export function pageTournois(): Child {
  const ts = tournoisRecentsDabord();
  return h(
    'div',
    null,
    titre('Tournois', store.saisie ? h('button', { type: 'button', class: 'principal', onclick: nouveauTournoi }, '+ Nouveau tournoi') : null),
    h(
      'div',
      { class: 'cartes-tournois' },
      ts.map((t, i) => {
        const c = champions(t.id);
        const nb = store.data.participations.filter((p) => p.tournoi === t.id).length;
        const cl = classement(t.id);
        const enCours = cl.some((l) => l.matchsRestants > 0) || (!c.series && i === 0);
        return h(
          'a',
          { href: `#/t/${t.id}`, class: `carte-tournoi ${i === 0 ? 'recent' : ''}` },
          h('div', { class: 'ct-annee' }, annee(t.date)),
          h('div', { class: 'ct-corps' }, h('div', { class: 'ct-lieu' }, t.lieu, enCours && i === 0 ? h('span', { class: 'pastille' }, 'en cours') : null), h('div', { class: 'ct-details' }, `${dateCourte(t.date)} · ${nb} joueurs · no ${t.id}`)),
          h(
            'div',
            { class: 'ct-champions' },
            c.saison ? h('span', { class: 'discret', title: 'Champion de la saison' }, '★ ', nomCourt(c.saison)) : null,
            c.series ? h('span', { title: 'Champion des séries' }, '🏆 ', nomCourt(c.series)) : null,
            c.consolation ? h('span', { class: 'discret', title: 'Champion de la consolation' }, iconeConsolation('Champion de la consolation'), ' ', nomCourt(c.consolation)) : null,
          ),
        );
      }),
    ),
  );
}

// ---------- Joueurs ----------

type LigneJoueur = { j: Joueur; s?: StatsVie };

export function pageJoueurs(): Child {
  const stats = new Map(statsVie({ types: ['Saison', 'Séries', 'Consolation', 'Finale'] }).map((s) => [s.joueur, s]));
  const lignes: LigneJoueur[] = store.data.joueurs.map((j) => ({ j, s: stats.get(j.id) }));
  const colonnes: Colonne<LigneJoueur>[] = [
    { titre: 'Surnom', cle: (x) => x.j.nomCourt, rendu: (x) => lienJoueur(x.j.id) },
    { titre: 'Nom', cle: (x) => x.j.nom, rendu: (x) => x.j.nom },
    { titre: 'Tourn.', aide: 'Participations', num: true, cle: (x) => x.s?.participations ?? 0, rendu: (x) => x.s?.participations || '' },
    { titre: 'Rang moy.', aide: 'Rang de saison moyen ramené sur 10 (rang ÷ participants × 10)', num: true, cle: (x) => -(x.s?.rangMoyen ?? 99), rendu: (x) => (x.s?.participations ? x.s.rangMoyen.toFixed(1) : '') },
    ...colonnesFiche<LigneJoueur>((x) => x.s?.fiche ?? ficheVide()),
    ...colonnesTitres<LigneJoueur>((x) => x.s),
  ];
  if (store.saisie) colonnes.push({ titre: '', rendu: (x) => h('button', { type: 'button', class: 'lien', onclick: () => editerJoueur(x.j) }, 'modifier') });
  return h(
    'div',
    null,
    titre('Joueurs', store.saisie ? h('button', { type: 'button', class: 'principal', onclick: () => editerJoueur() }, '+ Nouveau joueur') : null),
    tableTriable(colonnes, lignes, { col: 2, desc: true }),
  );
}

const resultatTableau = (r?: number, type = 'séries'): Child => {
  if (r === undefined) return '';
  if (r === 1) return type === 'séries' ? '🏆 Champion' : [iconeConsolation(), ' Champion'];
  if (r === 2) return 'Finaliste';
  if (r === 3) return 'Demi-finale';
  if (r === 5) return 'Quart de finale';
  return 'Huitième';
};

export function pageJoueur(id: number): Child {
  const j = joueur(id);
  if (!j) return h('p', null, 'Joueur introuvable.');
  const hist = historiqueJoueur(id);
  const tout = statsVie({ types: ['Saison', 'Séries', 'Consolation', 'Finale'] }).find((s) => s.joueur === id);
  const parType = (types: TypeMatch[]) => statsVie({ types }).find((s) => s.joueur === id)?.fiche;
  const lignesTypes: [string, Fiche | undefined][] = [
    ['Saison', parType(['Saison'])],
    ['Séries', parType(['Séries', 'Finale'])],
    ['Consolation', parType(['Consolation'])],
    ['Total', tout?.fiche],
  ];
  const parts = new Map(store.data.participations.filter((p) => p.joueur === id).map((p) => [p.tournoi, p.remarque]));
  return h(
    'div',
    null,
    titre(h('span', null, j.nomCourt, ' ', h('small', null, j.nom)), store.saisie ? h('button', { type: 'button', onclick: () => editerJoueur(j) }, 'Modifier') : null, h('a', { href: `#/face/${id}`, class: 'bouton' }, 'Face-à-face')),
    j.remarque ? h('p', { class: 'pre' }, j.remarque) : null,
    tout
      ? h(
          'div',
          { class: 'chiffres' },
          h('div', null, h('b', null, tout.participations), 'tournois'),
          h('div', { title: 'Rang de saison moyen ramené sur 10 (rang ÷ participants × 10)' }, h('b', null, tout.rangMoyen.toFixed(1)), 'rang moyen /10'),
          h('div', null, h('b', null, tout.titresSaison), 'titres de saison ★'),
          h('div', null, h('b', null, tout.titresSeries), 'titres des séries 🏆'),
          h('div', null, h('b', null, tout.titresConsolation), h('span', null, 'titres de consolation ', iconeConsolation())),
        )
      : null,
    h('h2', null, 'Fiche à vie'),
    h('div', { class: 'defile' }, h('table', { class: 'donnees' }, h('thead', null, h('tr', null, h('th', null, ''), thFiche())), h('tbody', null, lignesTypes.filter(([, f]) => f).map(([l, f]) => h('tr', { class: l === 'Total' ? 'total' : '' }, h('th', null, l), tdFiche(f!)))))),
    tout && tout.fiche.MG + tout.fiche.MP > 0 ? graphiquesFiche(tout.fiche) : null,
    h('h2', null, 'Tournoi par tournoi'),
    h('p', { class: 'discret' }, 'Rang et fiche de la saison régulière, puis résultat en séries ou en consolation.'),
    h(
      'div',
      { class: 'defile' },
      h(
        'table',
        { class: 'donnees' },
        h('thead', null, h('tr', null, h('th', null, 'Tournoi'), h('th', { class: 'num', title: 'Rang de la saison / participants' }, 'Rang'), thFiche(), h('th', null, 'Séries'), h('th', null, 'Consolation'), h('th', null, 'Remarque'))),
        h(
          'tbody',
          null,
          hist.map((l) => {
            const t = store.data.tournois.find((x) => x.id === l.tournoi)!;
            const f = l.saison.FC;
            return h(
              'tr',
              null,
              h('td', null, lienTournoi(t.id, `${annee(t.date)} ${t.lieu}`)),
              h('td', { class: 'num' }, h('b', null, l.rangSaison), h('span', { class: 'discret' }, `/${l.nbParticipants}`)),
              tdFiche(f),
              h('td', null, resultatTableau(l.rangSeries)),
              h('td', null, resultatTableau(l.rangConsolation, 'consolation')),
              h('td', { class: 'remarque' }, parts.get(t.id) ?? ''),
            );
          }),
        ),
      ),
    ),
  );
}

// ---------- Classement à vie ----------

const FILTRES_TYPES: [string, TypeMatch[]][] = [
  ['Tous les matchs', ['Saison', 'Séries', 'Finale', 'Consolation']],
  ['Saison', ['Saison']],
  ['Séries (et finales)', ['Séries', 'Finale']],
  ['Consolation', ['Consolation']],
];
const etatVie = { type: 0, de: 0, a: 0, minPart: 1 };

export function pageVie(): Child {
  const ts = [...store.data.tournois].sort((a, b) => a.date.localeCompare(b.date));
  if (!etatVie.de) etatVie.de = ts[0]?.id ?? 0;
  if (!etatVie.a) etatVie.a = ts[ts.length - 1]?.id ?? 0;
  const zone = h('div');
  const opts = (sel: number) => ts.map((t) => h('option', { value: t.id, selected: t.id === sel }, `${annee(t.date)} ${t.lieu}`));
  const selType = h('select', { onchange: (e: Event) => { etatVie.type = Number((e.target as HTMLSelectElement).value); rendre(); } }, FILTRES_TYPES.map(([l], i) => h('option', { value: i, selected: i === etatVie.type }, l)));
  const selDe = h('select', { onchange: (e: Event) => { etatVie.de = Number((e.target as HTMLSelectElement).value); rendre(); } }, opts(etatVie.de));
  const selA = h('select', { onchange: (e: Event) => { etatVie.a = Number((e.target as HTMLSelectElement).value); rendre(); } }, opts(etatVie.a));
  const min = h('input', { type: 'number', min: 1, max: 50, value: etatVie.minPart, class: 'court', oninput: (e: Event) => { etatVie.minPart = Number((e.target as HTMLInputElement).value) || 1; rendre(); } });

  const rendre = () => {
    const iDe = ts.findIndex((t) => t.id === etatVie.de);
    const iA = ts.findIndex((t) => t.id === etatVie.a);
    const ids = ts.slice(Math.min(iDe, iA), Math.max(iDe, iA) + 1).map((t) => t.id);
    const lignes = statsVie({ types: FILTRES_TYPES[etatVie.type][1], tournois: ids }).filter((s) => s.participations >= etatVie.minPart && s.fiche.MG + s.fiche.MP > 0);
    lignes.sort((a, b) => cote(b.fiche) - cote(a.fiche) || pourcentPoints(b.fiche) - pourcentPoints(a.fiche) || b.fiche.MG - a.fiche.MG);
    zone.replaceChildren(
      tableTriable(
        [
          { titre: '#', num: true, rendu: (_x, i) => i + 1 },
          { titre: 'Joueur', cle: (x) => nomCourt(x.joueur), rendu: (x) => lienJoueur(x.joueur) },
          { titre: 'Tourn.', aide: 'Participations', num: true, cle: (x) => x.participations, rendu: (x) => x.participations },
          { titre: 'Rang moy.', aide: 'Rang de saison moyen ramené sur 10 (rang ÷ participants × 10)', num: true, cle: (x) => -x.rangMoyen, rendu: (x) => x.rangMoyen.toFixed(1) },
          ...colonnesFiche<StatsVie>((x) => x.fiche),
          ...colonnesTitres<StatsVie>((x) => x),
        ],
        lignes,
      ),
    );
  };
  rendre();
  return h('div', null, titre('Classement à vie'), h('div', { class: 'filtres' }, h('label', null, 'Matchs ', selType), h('label', null, 'De ', selDe), h('label', null, 'à ', selA), h('label', null, 'Min. tournois ', min)), zone);
}

// ---------- Face-à-face ----------

let typeFace = 0;

/** Face-à-face : #/face/A (A contre chacun) ou #/face/A/B (A contre B) */
export function pageFace(id?: number, id2?: number): Child {
  const joueurs = [...store.data.joueurs].sort((a, b) => a.nomCourt.localeCompare(b.nomCourt, 'fr'));
  const aller = (a?: number, b?: number) => (location.hash = `#/face${a ? `/${a}` : ''}${a && b ? `/${b}` : ''}`);
  const valeur = (e: Event) => Number((e.target as HTMLSelectElement).value) || undefined;
  const sel = h('select', { onchange: (e: Event) => aller(valeur(e), id2 !== valeur(e) ? id2 : undefined) }, h('option', { value: '' }, '— choisir un joueur —'), joueurs.map((j) => h('option', { value: j.id, selected: j.id === id }, j.nomCourt)));
  const adversaires = id ? new Set(faceAFace(id, FILTRES_TYPES[0][1]).map((x) => x.adversaire)) : new Set<number>();
  const sel2 = h(
    'select',
    { disabled: !id, onchange: (e: Event) => aller(id, valeur(e)) },
    h('option', { value: '' }, 'tous les adversaires'),
    joueurs.filter((j) => adversaires.has(j.id)).map((j) => h('option', { value: j.id, selected: j.id === id2 }, j.nomCourt)),
  );
  const zone = h('div');
  const selType = h('select', { onchange: (e: Event) => { typeFace = Number((e.target as HTMLSelectElement).value); rendre(); } }, FILTRES_TYPES.map(([l], i) => h('option', { value: i, selected: i === typeFace }, l)));

  const rendre = () => {
    if (!id) return zone.replaceChildren(h('p', { class: 'discret' }, 'Choisissez un joueur pour voir sa fiche contre chacun de ses adversaires, puis au besoin un second joueur.'));
    if (id2) return zone.replaceChildren(h('div', null, vueDuel(id, id2)));
    const lignes = faceAFace(id, FILTRES_TYPES[typeFace][1]);
    zone.replaceChildren(
      tableTriable<FaceAFace>(
        [
          { titre: 'Adversaire', cle: (x) => nomCourt(x.adversaire), rendu: (x) => h('a', { href: `#/face/${id}/${x.adversaire}`, title: `${nomCourt(id)} contre ${nom(x.adversaire)}` }, nomCourt(x.adversaire)) },
          ...colonnesFiche<FaceAFace>((x) => x.fiche),
        ],
        lignes,
        { col: 1, desc: true },
      ),
    );
  };
  rendre();
  return h(
    'div',
    null,
    titre('Face-à-face'),
    h(
      'div',
      { class: 'filtres' },
      h('label', null, 'Joueur ', sel),
      h('label', null, 'contre ', sel2),
      id && id2 ? h('button', { type: 'button', class: 'mini', title: 'Inverser les deux joueurs', onclick: () => aller(id2, id) }, '⇄') : null,
      id2 ? null : h('label', null, 'Matchs ', selType),
    ),
    zone,
  );
}

/** Duel entre deux joueurs : bilan, fiche par type de match et liste des matchs. */
function vueDuel(a: number, b: number): Child {
  const parType = (types: TypeMatch[]) => faceAFace(a, types).find((x) => x.adversaire === b)?.fiche ?? ficheVide();
  const lignes: [string, Fiche][] = [
    ['Saison', parType(['Saison'])],
    ['Séries', parType(['Séries', 'Finale'])],
    ['Consolation', parType(['Consolation'])],
    ['Total', parType(FILTRES_TYPES[0][1])],
  ];
  const total = lignes[3][1];
  const matchs = store.data.matchs
    .filter((m) => (m.gagnant === a && m.perdant === b) || (m.gagnant === b && m.perdant === a))
    .sort((x, y) => (y.dateHeure ?? '').localeCompare(x.dateHeure ?? '') || y.tournoi - x.tournoi);
  const tn = new Map(store.data.tournois.map((t) => [t.id, t]));
  if (!matchs.length) return h('p', { class: 'vide' }, `${nomCourt(a)} et ${nomCourt(b)} ne se sont jamais affrontés.`);
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'duel' },
      h('div', { class: `duel-joueur ${total.MG > total.MP ? 'mene' : ''}` }, lienJoueur(a), h('b', null, total.MG)),
      h('div', { class: 'duel-centre' }, 'victoires', h('small', null, `${total.MG + total.MP} matchs · points ${total.PP}-${total.PC}`)),
      h('div', { class: `duel-joueur ${total.MP > total.MG ? 'mene' : ''}` }, h('b', null, total.MP), lienJoueur(b)),
    ),
    h('h2', null, `Fiche de ${nomCourt(a)} contre ${nomCourt(b)}`),
    h(
      'div',
      { class: 'defile' },
      h(
        'table',
        { class: 'donnees' },
        h('thead', null, h('tr', null, h('th', null, ''), thFiche())),
        h('tbody', null, lignes.filter(([, f]) => f.MG + f.MP > 0).map(([l, f]) => h('tr', { class: l === 'Total' ? 'total' : '' }, h('th', null, l), tdFiche(f)))),
      ),
    ),
    h('h2', null, 'Leurs matchs'),
    h(
      'div',
      { class: 'defile' },
      h(
        'table',
        { class: 'donnees' },
        h('thead', null, h('tr', null, h('th', null, 'Tournoi'), h('th', null, 'Type'), h('th', null, 'Gagnant'), h('th', { class: 'num' }, 'Pointage'), h('th', null, 'Perdant'), h('th', null, ''), h('th', null, 'Remarque'))),
        h(
          'tbody',
          null,
          matchs.map((m) => {
            const t = tn.get(m.tournoi)!;
            return h(
              'tr',
              { class: m.gagnant === a ? 'gagne' : 'perd' },
              h('td', null, lienTournoi(t.id, `${annee(t.date)} ${t.lieu}`)),
              h('td', null, m.type),
              h('td', { class: 'fort' }, nomCourt(m.gagnant)),
              h('td', { class: 'num fort' }, `${m.scoreG}-${m.scoreP}`),
              h('td', null, nomCourt(m.perdant)),
              h('td', { class: 'discret' }, [m.blanchissage ? 'blanchissage' : '', m.supplementaire ? 'supplémentaire' : ''].filter(Boolean).join(' ')),
              h('td', { class: 'remarque' }, m.remarque ?? ''),
            );
          }),
        ),
      ),
    ),
  );
}

// ---------- Matchs ----------

// Filtres conservés entre les rafraîchissements (ex. après une suppression)
const etatMatchs: { a?: number; b?: number; tournoi: number; type: string; route: string } = { tournoi: 0, type: '', route: '' };

/** Routes : #/matchs, #/matchs/j/A[/B], #/matchs/t/ID */
export function pageMatchs(param?: string, x?: number, y?: number): Child {
  const route = location.hash;
  if (route !== etatMatchs.route) {
    // Nouvelle navigation : les filtres viennent de l'adresse
    Object.assign(etatMatchs, { route, a: undefined, b: undefined, tournoi: 0, type: '' });
    if (param === 'j') Object.assign(etatMatchs, { a: x, b: y });
    if (param === 't') etatMatchs.tournoi = x ?? 0;
  }
  const etat = etatMatchs;
  const joueurs = [...store.data.joueurs].sort((p, q) => p.nomCourt.localeCompare(q.nomCourt, 'fr'));
  const optJ = (v?: number) => [h('option', { value: '' }, 'tous'), joueurs.map((j) => h('option', { value: j.id, selected: j.id === v }, j.nomCourt))];
  const zone = h('div');
  const num = (e: Event) => Number((e.target as HTMLSelectElement).value) || undefined;

  const supprimer = (m: Match) => {
    const blocage = blocageMatch(store.data, m);
    if (blocage) return avis(blocage, 'erreur');
    const t = store.data.tournois.find((z) => z.id === m.tournoi)!;
    modale('Supprimer ce match ?', h('p', null, `${nomCourt(m.gagnant)} ${m.scoreG}-${m.scoreP} ${nomCourt(m.perdant)} — ${m.type}, ${annee(t.date)} ${t.lieu}`), [
      { texte: 'Annuler', action: () => {} },
      { texte: 'Supprimer', classe: 'danger', action: () => store.modifier((d) => { d.matchs = d.matchs.filter((z) => !memeMatch(z, m)); }) },
    ]);
  };

  const rendre = () => {
    let l = store.data.matchs.filter(
      (m) =>
        (!etat.tournoi || m.tournoi === etat.tournoi) &&
        (!etat.type || m.type === etat.type || (etat.type === 'Séries' && m.type === 'Finale')) &&
        (!etat.a || m.gagnant === etat.a || m.perdant === etat.a) &&
        (!etat.b || m.gagnant === etat.b || m.perdant === etat.b),
    );
    const total = l.length;
    l = [...l].sort((p, q) => (q.dateHeure ?? '').localeCompare(p.dateHeure ?? '') || q.tournoi - p.tournoi).slice(0, 400);
    const tn = new Map(store.data.tournois.map((t) => [t.id, t]));
    zone.replaceChildren(
      h('p', { class: 'discret' }, `${total} match${total > 1 ? 's' : ''}${total > l.length ? ` (${l.length} plus récents affichés)` : ''}`),
      h(
        'div',
        { class: 'defile' },
        h(
          'table',
          { class: 'donnees' },
          h('thead', null, h('tr', null, h('th', null, 'Tournoi'), h('th', null, 'Type'), h('th', null, 'Gagnant'), h('th', { class: 'num' }, 'Pointage'), h('th', null, 'Perdant'), h('th', null, ''), h('th', null, 'Heure'), h('th', null, 'Remarque'), store.saisie ? h('th', null, '') : null)),
          h(
            'tbody',
            null,
            l.map((m) => {
              const t = tn.get(m.tournoi)!;
              const blocage = store.saisie ? blocageMatch(store.data, m) : undefined;
              return h(
                'tr',
                null,
                h('td', null, lienTournoi(t.id, `${annee(t.date)} ${t.lieu}`)),
                h('td', null, m.type),
                h('td', null, lienJoueur(m.gagnant)),
                h('td', { class: 'num fort' }, `${m.scoreG}-${m.scoreP}`),
                h('td', null, lienJoueur(m.perdant)),
                h('td', { class: 'discret' }, [m.blanchissage ? 'blanchissage' : '', m.supplementaire ? 'supplémentaire' : ''].filter(Boolean).join(' ')),
                h('td', { class: 'discret' }, heure(m.dateHeure) || ''),
                h('td', { class: 'remarque' }, m.remarque ?? ''),
                store.saisie
                  ? h('td', null, h('button', { type: 'button', class: 'mini danger', disabled: Boolean(blocage), title: blocage ?? 'Supprimer ce match', onclick: () => supprimer(m) }, 'Supprimer'))
                  : null,
              );
            }),
          ),
        ),
      ),
    );
  };
  rendre();
  const ts = tournoisRecentsDabord();
  return h(
    'div',
    null,
    titre('Matchs'),
    h(
      'div',
      { class: 'filtres' },
      h('label', null, 'Tournoi ', h('select', { onchange: (e: Event) => { etat.tournoi = num(e) ?? 0; rendre(); } }, h('option', { value: '' }, 'tous'), ts.map((t) => h('option', { value: t.id, selected: t.id === etat.tournoi }, `${annee(t.date)} ${t.lieu}`)))),
      h('label', null, 'Type ', h('select', { onchange: (e: Event) => { etat.type = (e.target as HTMLSelectElement).value; rendre(); } }, h('option', { value: '' }, 'tous'), ['Saison', 'Séries', 'Consolation'].map((z) => h('option', { value: z, selected: z === etat.type }, z)))),
      h('label', null, 'Joueur ', h('select', { onchange: (e: Event) => { etat.a = num(e); rendre(); } }, optJ(etat.a))),
      h('label', null, 'contre ', h('select', { onchange: (e: Event) => { etat.b = num(e); rendre(); } }, optJ(etat.b))),
    ),
    zone,
  );
}
