// Page d'un tournoi : saison (grille), classement, séries, consolation, participants
import { champions, classement, nom, nomCourt, tableau } from '../calc';
import { avis, h, modale, type Child } from '../dom';
import type { Tableau, MatchTableau, Case } from '../engine/bracket';
import type { LigneClassement } from '../engine/classement';
import type { Fiche } from '../engine/fiche';
import { matchsDuTournoi } from '../engine/integrite';
import { participantsTournoi } from '../engine/tournoi';
import { dateCourte, heure } from '../format';
import type { Match, Tournoi, TypeMatch } from '../model';
import { store } from '../store';
import { lienJoueur, tdFiche, thFiche, titre } from './commun';
import { ouvrirSaisie } from './saisie';
import { editerParametres, editerParticipants } from './edition';

type Onglet = 'saison' | 'classement' | 'series' | 'consolation' | 'infos';

export function pageTournoi(id: number, onglet?: string): Child {
  const t = store.data.tournois.find((x) => x.id === id);
  if (!t) return h('p', null, 'Tournoi introuvable.');
  const cl = classement(id);
  const termine = cl.length > 1 && cl.every((l) => l.matchsRestants === 0);
  const actif = (onglet as Onglet) || (termine ? 'series' : 'saison');
  const ch = champions(id);

  const onglets: [Onglet, string][] = [
    ['saison', 'Saison'],
    ['classement', 'Classement'],
    ['series', 'Séries'],
    ['consolation', 'Consolation'],
    ['infos', store.saisie ? 'Participants & réglages' : 'Infos'],
  ];

  let contenu: Child;
  switch (actif) {
    case 'saison':
      contenu = vueGrille(t, 'Saison', participantsTournoi(store.data, id));
      break;
    case 'classement':
      contenu = vueClassement(t, cl, 'Saison');
      break;
    case 'series':
      contenu = t.typeSeries === 'ronde' ? vueSeriesRonde(t) : vueTableau(t, tableau(id, 'Séries'), 'Séries');
      break;
    case 'consolation':
      contenu = vueTableau(t, tableau(id, 'Consolation'), 'Consolation');
      break;
    case 'infos':
      contenu = vueInfos(t);
      break;
  }

  return h(
    'div',
    null,
    titre(
      h('span', null, `${t.lieu} `, h('small', null, `· ${dateCourte(t.date)} · tournoi no ${t.id}`)),
    ),
    h(
      'div',
      { class: 'palmares' },
      palme('Séries', ch.series),
      palme('Saison', ch.saison),
      palme('Consolation', ch.consolation),
    ),
    h('nav', { class: 'onglets' }, onglets.map(([o, l]) => h('a', { href: `#/t/${id}/${o}`, class: o === actif ? 'actif' : '' }, l))),
    h('section', { class: 'onglet' }, contenu),
  );
}

function palme(libelle: string, j?: number) {
  return h('div', { class: `palme ${j ? '' : 'vide'}` }, h('span', { class: 'palme-titre' }, `Champion ${libelle.toLowerCase()}`), j ? lienJoueur(j) : h('span', null, '—'));
}

// ---------- Grille de la saison (round robin) ----------

export function vueGrille(t: Tournoi, type: 'Saison' | 'Séries', joueurs: number[]): Child {
  const ordre = [...joueurs].sort((a, b) => nomCourt(a).localeCompare(nomCourt(b), 'fr'));
  const matchs = store.data.matchs.filter((m) => m.tournoi === t.id && m.type === type);
  const res = new Map<string, Match>();
  for (const m of matchs) {
    res.set(`${m.gagnant}-${m.perdant}`, m);
    res.set(`${m.perdant}-${m.gagnant}`, m);
  }
  const total = (joueurs.length * (joueurs.length - 1)) / 2;
  const joues = new Set(matchs.map((m) => [m.gagnant, m.perdant].sort().join('-'))).size;

  const cellule = (a: number, b: number) => {
    if (a === b) return h('td', { class: 'diag' });
    const m = res.get(`${a}-${b}`);
    const cliquable = store.saisie;
    const attrs: Record<string, unknown> = {
      class: ['res', m ? (m.gagnant === a ? 'victoire' : 'defaite') : 'nonjoue', cliquable ? 'cliquable' : ''].join(' '),
      title: `${nom(a)} c. ${nom(b)}${m?.dateHeure ? `\n${dateCourte(m.dateHeure)} ${heure(m.dateHeure)}` : ''}${m?.remarque ? `\n${m.remarque}` : ''}`,
    };
    if (cliquable) attrs.onclick = () => ouvrirSaisie({ tournoi: t.id, type, joueur1: a, joueur2: b });
    if (!m) return h('td', attrs, cliquable ? '+' : '');
    const [p, c] = m.gagnant === a ? [m.scoreG, m.scoreP] : [m.scoreP, m.scoreG];
    return h('td', attrs, `${p}-${c}`, m.blanchissage ? h('sup', null, '0') : null, m.supplementaire ? h('sup', null, 's') : null, m.remarque ? h('span', { class: 'rem-ind' }, '•') : null);
  };

  return h(
    'div',
    null,
    h(
      'p',
      { class: 'progression' },
      h('progress', { max: total, value: joues }),
      ` ${joues} matchs joués sur ${total}`,
      store.saisie ? h('span', { class: 'discret' }, ' · cliquez une case pour saisir un résultat') : null,
    ),
    h(
      'div',
      { class: 'defile' },
      h(
        'table',
        { class: 'grille' },
        h('thead', null, h('tr', null, h('th', { class: 'coin' }, 'Ligne c. colonne'), ordre.map((j) => h('th', { class: 'col-joueur', title: nom(j) }, h('span', null, nomCourt(j)))))),
        h('tbody', null, ordre.map((a) => h('tr', null, h('th', { class: 'ligne-joueur' }, lienJoueur(a)), ordre.map((b) => cellule(a, b))))),
      ),
    ),
    h('p', { class: 'legende' }, h('span', { class: 'res victoire' }, '3-1'), ' victoire du joueur de la ligne ', h('span', { class: 'res defaite' }, '1-3'), ' défaite · ', h('sup', null, '0'), ' blanchissage · ', h('sup', null, 's'), ' supplémentaire · • remarque'),
  );
}

// ---------- Classement ----------

type ModeFiche = 'FC' | 'FR' | 'FV' | 'MN' | 'MX';
const MODES: [ModeFiche, string, string][] = [
  ['FC', 'Courante', 'Tous les matchs de la ronde'],
  ['FR', 'Relative', 'Matchs entre joueurs à égalité seulement (bris d’égalité)'],
  ['FV', 'À vie', 'Tournois antérieurs (dernier bris d’égalité)'],
  ['MN', 'Minimale', 'Si le joueur perd tous ses matchs restants'],
  ['MX', 'Maximale', 'Si le joueur gagne tous ses matchs restants'],
];
let modeClassement: ModeFiche = 'FC';

export function vueClassement(t: Tournoi, cl: LigneClassement[], type: 'Saison' | 'Séries'): Child {
  const conteneur = h('div');
  const qualifies = type === 'Saison' ? t.nbJoueursSeries : 0;
  const enCours = cl.some((l) => l.matchsRestants > 0);
  const rendre = () => {
    const remarques = new Map(store.data.participations.filter((p) => p.tournoi === t.id).map((p) => [p.joueur, p.remarque]));
    const avecRem = cl.some((l) => remarques.get(l.joueur));
    conteneur.replaceChildren(
      h('div', { class: 'segments' }, MODES.map(([m, l, aide]) => h('button', { type: 'button', class: m === modeClassement ? 'actif' : '', title: aide, onclick: () => { modeClassement = m; rendre(); } }, l))),
      h(
        'div',
        { class: 'defile' },
        h(
          'table',
          { class: 'donnees classement' },
          h('thead', null, h('tr', null, h('th', { class: 'num' }, 'Rg'), h('th', { title: 'C = champion assuré, s = assuré des séries, X = éliminé des séries' }, ''), h('th', null, 'Joueur'), enCours ? h('th', { class: 'num', title: 'Matchs restants' }, 'Rest.') : null, thFiche(), enCours ? h('th', { class: 'num', title: 'Meilleur et pire rang encore possibles' }, 'Possible') : null, avecRem ? h('th', null, 'Remarque') : null)),
          h(
            'tbody',
            null,
            cl.map((l) =>
              h(
                'tr',
                { class: qualifies && l.rang === qualifies ? 'coupure' : '' },
                h('td', { class: 'num fort' }, l.rang, l.rangForce ? h('span', { class: 'force', title: `Rang forcé (calculé : ${l.rangCalcule})` }, '*') : null),
                h('td', { class: `statut statut-${l.statut.trim() || 'aucun'}` }, l.statut.trim()),
                h('td', null, lienJoueur(l.joueur)),
                enCours ? h('td', { class: 'num discret' }, l.matchsRestants || '') : null,
                tdFiche(l[modeClassement] as Fiche),
                enCours ? h('td', { class: 'num discret' }, l.meilleurRang === l.pireRang ? l.meilleurRang : `${l.meilleurRang}–${l.pireRang}`) : null,
                avecRem ? h('td', { class: 'remarque' }, remarques.get(l.joueur) ?? '') : null,
              ),
            ),
          ),
        ),
      ),
      h('p', { class: 'legende' }, qualifies ? `Les ${qualifies} premiers participent aux séries (trait sous le dernier qualifié). ` : '', 'C = champion assuré · s = assuré des séries · X = éliminé des séries. ', 'Bris d’égalité : victoires, défaites, ', t.deltaAvantPP ? 'différentiel, ' : '', 'points pour, points contre, puis fiche relative, blanchissages, supplémentaires et fiche à vie.'),
    );
  };
  rendre();
  return conteneur;
}

// ---------- Séries à la ronde (tournoi 1) ----------

function vueSeriesRonde(t: Tournoi): Child {
  const cl = classement(t.id, 'Séries');
  return h('div', null, h('p', { class: 'discret' }, `Séries jouées à la ronde entre les ${t.nbJoueursSeries} premiers.`), vueGrille(t, 'Séries', cl.map((l) => l.joueur)), vueClassement(t, cl, 'Séries'));
}

// ---------- Tableau à élimination ----------

function nomRonde(r: number, nb: number, type: string): string {
  const reste = nb - r;
  if (reste === 0) return type === 'Séries' ? 'Grande finale' : 'Finale';
  if (reste === 1) return 'Demi-finales';
  if (reste === 2) return 'Quarts de finale';
  if (reste === 3) return 'Huitièmes de finale';
  return `Ronde ${r}`;
}

function vueTableau(t: Tournoi, tab: Tableau | null, type: 'Séries' | 'Consolation'): Child {
  if (!tab) {
    const n = participantsTournoi(store.data, t.id).length;
    return h('p', { class: 'vide' }, type === 'Consolation' ? (n - t.nbJoueursSeries < 2 ? 'Pas de consolation : moins de deux joueurs hors des séries.' : 'Aucun joueur.') : 'Aucun joueur.');
  }
  const cl = classement(t.id);
  const saisonFinie = cl.every((l) => l.matchsRestants === 0);

  const caseJoueur = (c: Case, m: MatchTableau, haut: boolean) => {
    const score = m.match ? (c.etat === 'joueur' && c.joueur === m.match.gagnant ? m.match.scoreG : m.match.scoreP) : '';
    const gagne = c.etat === 'joueur' && m.vainqueur === c.joueur && !m.laissezPasser;
    return h(
      'div',
      { class: ['case', gagne ? 'gagnant' : '', m.vainqueur && !gagne && c.etat === 'joueur' && !m.laissezPasser ? 'perdant' : ''].join(' ') },
      h('span', { class: 'tete' }, c.etat === 'joueur' && c.tete ? c.tete : ''),
      h('span', { class: 'nom' }, c.etat === 'joueur' ? nomCourt(c.joueur) : c.etat === 'vide' ? (haut ? '' : 'laissez-passer') : '…'),
      h('span', { class: 'score' }, score),
    );
  };

  const carte = (m: MatchTableau) => {
    const pret = m.haut.etat === 'joueur' && m.bas.etat === 'joueur';
    const cliquable = store.saisie && pret && !m.laissezPasser;
    const attrs: Record<string, unknown> = {
      class: ['match-carte', m.laissezPasser ? 'lp' : '', cliquable ? 'cliquable' : '', m.type === 'Finale' ? 'finale' : ''].join(' '),
      title: m.match ? `${dateCourte(m.match.dateHeure)} ${heure(m.match.dateHeure)}${m.match.remarque ? `\n${m.match.remarque}` : ''}` : '',
    };
    if (cliquable && m.haut.etat === 'joueur' && m.bas.etat === 'joueur') {
      const j1 = m.haut.joueur;
      const j2 = m.bas.joueur;
      attrs.onclick = () => {
        if (!saisonFinie && !m.match && !confirm('La saison n’est pas terminée : le tableau peut encore changer. Saisir quand même ?')) return;
        ouvrirSaisie({ tournoi: t.id, type: m.type, joueur1: j1, joueur2: j2, ronde: m.ronde, idMatch: m.idMatch });
      };
    }
    if (m.laissezPasser && m.haut.etat === 'vide' && m.bas.etat === 'vide') return h('div', { class: 'match-carte fantome' });
    return h('div', attrs, caseJoueur(m.haut, m, true), caseJoueur(m.bas, m, false), m.match?.remarque ? h('div', { class: 'carte-rem' }, m.match.remarque) : null);
  };

  return h(
    'div',
    null,
    !saisonFinie ? h('p', { class: 'avertissement' }, 'La saison n’est pas terminée : ce tableau est provisoire (selon le classement actuel).') : null,
    tab.champion ? h('p', { class: 'champion' }, `🏆 ${type === 'Séries' ? 'Champion des séries' : 'Champion de la consolation'} : `, lienJoueur(tab.champion, false)) : null,
    h(
      'div',
      { class: 'defile' },
      h(
        'div',
        { class: 'bracket', style: { '--nb-rondes': String(tab.nbRondes) } },
        tab.rondes.map((ronde, i) =>
          h(
            'div',
            { class: 'ronde' },
            h('h3', null, nomRonde(i + 1, tab.nbRondes, type), h('small', null, ` · ${t.pointsGagnants[ronde[0].type]} de ${2 * t.pointsGagnants[ronde[0].type] - 1}`)),
            h('div', { class: 'ronde-matchs' }, ronde.map((m) => h('div', { class: 'emplacement' }, carte(m)))),
          ),
        ),
      ),
    ),
    store.saisie ? h('p', { class: 'legende' }, 'Cliquez un match dont les deux joueurs sont connus pour saisir le résultat. Les têtes de série viennent du classement de la saison.') : null,
  );
}

// ---------- Infos / participants ----------

function vueInfos(t: Tournoi): Child {
  const parts = store.data.participations.filter((p) => p.tournoi === t.id);
  const typesTxt = (['Saison', 'Séries', 'Consolation', 'Finale'] as TypeMatch[]).map((k) => `${k} : ${t.pointsGagnants[k]} de ${2 * t.pointsGagnants[k] - 1}`).join(' · ');
  return h(
    'div',
    { class: 'infos' },
    store.saisie
      ? h('div', { class: 'boutons' }, h('button', { type: 'button', onclick: () => editerParametres(t) }, 'Modifier les réglages'), h('button', { type: 'button', onclick: () => editerParticipants(t) }, 'Participants, remarques et rangs forcés'), h('button', { type: 'button', class: 'danger', onclick: () => supprimerTournoi(t), title: 'Possible seulement si aucun match n’est saisi' }, 'Supprimer le tournoi'))
      : null,
    h(
      'dl',
      null,
      h('dt', null, 'Date'), h('dd', null, dateCourte(t.date)),
      h('dt', null, 'Lieu'), h('dd', null, t.lieu),
      h('dt', null, 'Participants'), h('dd', null, parts.length),
      h('dt', null, 'Joueurs en séries'), h('dd', null, t.nbJoueursSeries, t.typeSeries === 'ronde' ? ' (à la ronde)' : ''),
      h('dt', null, 'Matchs'), h('dd', null, typesTxt),
      h('dt', null, 'Bris d’égalité'), h('dd', null, t.deltaAvantPP ? 'Différentiel avant les points pour' : 'Points pour, puis points contre'),
      t.remarque ? [h('dt', null, 'Remarque'), h('dd', { class: 'pre' }, t.remarque)] : null,
    ),
    h('h3', null, 'Participants'),
    h('ul', { class: 'participants' }, parts.sort((a, b) => nomCourt(a.joueur).localeCompare(nomCourt(b.joueur), 'fr')).map((p) => h('li', null, lienJoueur(p.joueur), ` (${nom(p.joueur)})`, p.remarque ? h('span', { class: 'discret' }, ` — ${p.remarque}`) : null))),
  );
}

function supprimerTournoi(t: Tournoi) {
  const nb = matchsDuTournoi(store.data, t.id).length;
  if (nb > 0) {
    modale('Suppression impossible', h('p', null, `Ce tournoi a ${nb} match${nb > 1 ? 's' : ''} saisi${nb > 1 ? 's' : ''}. Supprimez d’abord tous ses matchs, puis revenez supprimer le tournoi.`), [
      { texte: 'Fermer', action: () => {} },
      { texte: `Voir les ${nb} matchs`, classe: 'principal', action: () => void (location.hash = `#/matchs/t/${t.id}`) },
    ]);
    return;
  }
  modale('Supprimer le tournoi', h('p', null, `Supprimer « ${t.lieu} » (${dateCourte(t.date)}) et ses inscriptions ? Aucun match n’y est saisi.`), [
    { texte: 'Annuler', action: () => {} },
    {
      texte: 'Supprimer',
      classe: 'danger',
      action: () => {
        const ok = store.modifier((d) => {
          if (matchsDuTournoi(d, t.id).length) throw new Error('Ce tournoi a des matchs.');
          d.tournois = d.tournois.filter((x) => x.id !== t.id);
          d.participations = d.participations.filter((x) => x.tournoi !== t.id);
        });
        if (!ok) return false;
        avis('Tournoi supprimé');
        location.hash = '#/';
      },
    },
  ]);
}
