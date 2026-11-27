// Formulaires d'édition (mode saisie) : tournoi, participants, joueurs
import { nom, nomCourt } from '../calc';
import { avis, h, modale } from '../dom';
import { aujourdhui } from '../format';
import { TYPES_MATCH, type Joueur, type Tournoi, type TypeMatch } from '../model';
import { matchsDuJoueur, matchsDuTournoi } from '../engine/integrite';
import { store } from '../store';
import { champ } from './commun';

const erreur = (msg: string): false => {
  avis(msg, 'erreur');
  return false;
};

const nombre = (v: number, min = 0, max = 99) => h('input', { type: 'number', min, max, value: v, class: 'court' }) as HTMLInputElement;

function formulaireParametres(t: Partial<Tournoi>) {
  const date = h('input', { type: 'date', value: t.date ?? aujourdhui() });
  const lieu = h('input', { type: 'text', value: t.lieu ?? '', placeholder: 'ex. Buckland 4' });
  const nbSeries = nombre(t.nbJoueursSeries ?? 8, 0, 16);
  const typeSeries = h('select', null, h('option', { value: 'elimination' }, 'Élimination directe'), h('option', { value: 'ronde' }, 'À la ronde'));
  typeSeries.value = t.typeSeries ?? 'elimination';
  const delta = h('input', { type: 'checkbox', checked: t.deltaAvantPP ?? false });
  const pts = Object.fromEntries(TYPES_MATCH.map((k) => [k, nombre(t.pointsGagnants?.[k] ?? (k === 'Finale' ? 4 : 3), 1, 9)])) as Record<TypeMatch, HTMLInputElement>;
  const rem = h('textarea', { rows: 3 }, t.remarque ?? '');
  const el = h(
    'div',
    { class: 'formulaire' },
    champ('Date', date),
    champ('Lieu', lieu),
    champ('Joueurs en séries', nbSeries, 'Normalement 8. Les autres jouent la consolation.'),
    champ('Formule des séries', typeSeries),
    h('fieldset', null, h('legend', null, 'Points pour gagner un match'), h('div', { class: 'ligne' }, TYPES_MATCH.map((k) => champ(k, pts[k])))),
    h('label', { class: 'case-a-cocher' }, delta, ' Le différentiel (PP − PC) départage avant les points pour'),
    champ('Remarque', rem),
  );
  const lire = (): Omit<Tournoi, 'id'> | string => {
    if (!date.value) return 'La date est obligatoire.';
    if (!lieu.value.trim()) return 'Le lieu est obligatoire.';
    return {
      date: date.value,
      lieu: lieu.value.trim(),
      nbJoueursSeries: Number(nbSeries.value) || 0,
      typeSeries: typeSeries.value as Tournoi['typeSeries'],
      deltaAvantPP: delta.checked,
      pointsGagnants: Object.fromEntries(TYPES_MATCH.map((k) => [k, Number(pts[k].value) || 3])) as Record<TypeMatch, number>,
      remarque: rem.value.trim() || null,
    };
  };
  return { el, lire };
}

export function editerParametres(t: Tournoi) {
  const aDesSeries = store.data.matchs.some((m) => m.tournoi === t.id && m.type !== 'Saison');
  const f = formulaireParametres(t);
  modale(`Réglages — ${t.lieu}`, h('div', null, aDesSeries ? h('p', { class: 'avertissement' }, 'Des matchs de séries ou de consolation sont déjà saisis : changer le nombre de joueurs en séries peut défaire le tableau.') : null, f.el), [
    { texte: 'Annuler', action: () => {} },
    {
      texte: 'Enregistrer',
      classe: 'principal',
      action: () => {
        const v = f.lire();
        if (typeof v === 'string') return erreur(v);
        const nbPart = store.data.participations.filter((p) => p.tournoi === t.id).length;
        if (v.nbJoueursSeries > nbPart) return erreur('Plus de joueurs en séries que de participants.');
        return store.modifier((d) => Object.assign(d.tournois.find((x) => x.id === t.id)!, v));
      },
    },
  ]);
}

export function nouveauTournoi() {
  const dernier = [...store.data.tournois].sort((a, b) => b.date.localeCompare(a.date))[0];
  const f = formulaireParametres({ ...dernier, date: aujourdhui(), lieu: '', remarque: null });
  const derniersParticipants = new Set(store.data.participations.filter((p) => p.tournoi === dernier?.id).map((p) => p.joueur));
  const choix = listeJoueurs(derniersParticipants);
  modale('Nouveau tournoi', h('div', null, f.el, h('h3', null, 'Participants'), choix.el), [
    { texte: 'Annuler', action: () => {} },
    {
      texte: 'Créer',
      classe: 'principal',
      action: () => {
        const v = f.lire();
        if (typeof v === 'string') return erreur(v);
        const joueurs = choix.lire();
        if (joueurs.length < 2) return erreur('Il faut au moins deux participants.');
        if (v.nbJoueursSeries > joueurs.length) v.nbJoueursSeries = joueurs.length;
        const id = Math.max(0, ...store.data.tournois.map((x) => x.id)) + 1;
        const ok = store.modifier((d) => {
          d.tournois.push({ id, ...v });
          for (const j of joueurs) d.participations.push({ tournoi: id, joueur: j });
        });
        if (!ok) return false;
        location.hash = `#/t/${id}/saison`;
      },
    },
  ]);
}

/** @param verrouilles joueurs qu'on ne peut pas décocher → nombre de matchs joués */
function listeJoueurs(coches: Set<number>, verrouilles = new Map<number, number>()) {
  const boites = new Map<number, HTMLInputElement>();
  const tri = [...store.data.joueurs].sort((a, b) => a.nomCourt.localeCompare(b.nomCourt, 'fr'));
  const el = h(
    'div',
    { class: 'liste-joueurs' },
    tri.map((j) => {
      const nb = verrouilles.get(j.id);
      const b = h('input', { type: 'checkbox', checked: coches.has(j.id) || Boolean(nb), disabled: Boolean(nb) }) as HTMLInputElement;
      boites.set(j.id, b);
      return h(
        'label',
        { class: nb ? 'verrouille' : '', title: nb ? `${j.nom} a joué ${nb} match${nb > 1 ? 's' : ''} dans ce tournoi : on ne peut pas le retirer` : j.nom },
        b,
        ` ${j.nomCourt}`,
        nb ? h('small', null, ` 🔒 ${nb}`) : h('small', null, ` ${j.nom}`),
      );
    }),
  );
  return { el, lire: () => [...boites.entries()].filter(([, b]) => b.checked).map(([id]) => id) };
}

export function editerParticipants(t: Tournoi) {
  const parts = store.data.participations.filter((p) => p.tournoi === t.id);
  const avecMatchs = new Map<number, number>();
  for (const m of matchsDuTournoi(store.data, t.id)) for (const j of [m.gagnant, m.perdant]) avecMatchs.set(j, (avecMatchs.get(j) ?? 0) + 1);
  const choix = listeJoueurs(new Set(parts.map((p) => p.joueur)), avecMatchs);
  const details = h(
    'table',
    { class: 'donnees compact' },
    h('thead', null, h('tr', null, h('th', null, 'Joueur'), h('th', null, 'Remarque'), h('th', { title: 'Rang imposé au classement de saison (0 = calculé)' }, 'Rang forcé saison'))),
    h(
      'tbody',
      null,
      parts
        .sort((a, b) => nomCourt(a.joueur).localeCompare(nomCourt(b.joueur), 'fr'))
        .map((p) =>
          h(
            'tr',
            { 'data-joueur': p.joueur },
            h('td', { title: nom(p.joueur) }, nomCourt(p.joueur)),
            h('td', null, h('input', { type: 'text', class: 'rem', value: p.remarque ?? '' })),
            h('td', null, h('input', { type: 'number', min: 0, max: 30, class: 'court rf', value: p.rangForce?.Saison ?? 0 })),
          ),
        ),
    ),
  );
  modale(`Participants — ${t.lieu}`, h('div', null, h('p', { class: 'discret' }, '🔒 Un joueur qui a déjà au moins un match dans ce tournoi ne peut pas être retiré (supprimez d’abord ses matchs).'), choix.el, h('h3', null, 'Remarques et rangs forcés'), h('div', { class: 'defile' }, details)), [
    { texte: 'Annuler', action: () => {} },
    {
      texte: 'Enregistrer',
      classe: 'principal',
      action: () => {
        const joueurs = new Set(choix.lire());
        if (joueurs.size < 2) return erreur('Il faut au moins deux participants.');
        const saisies = new Map<number, { rem: string; rf: number }>();
        details.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
          saisies.set(Number(tr.dataset.joueur), { rem: tr.querySelector<HTMLInputElement>('.rem')!.value.trim(), rf: Number(tr.querySelector<HTMLInputElement>('.rf')!.value) || 0 });
        });
        return store.modifier((d) => {
          // Contrainte : on ne retire pas un participant qui a joué
          for (const j of new Set(matchsDuTournoi(d, t.id).flatMap((m) => [m.gagnant, m.perdant])))
            if (!joueurs.has(j)) throw new Error(`${nomCourt(j)} a déjà joué dans ce tournoi : on ne peut pas le retirer.`);
          d.participations = d.participations.filter((p) => p.tournoi !== t.id || joueurs.has(p.joueur));
          for (const j of joueurs) if (!d.participations.some((p) => p.tournoi === t.id && p.joueur === j)) d.participations.push({ tournoi: t.id, joueur: j });
          for (const p of d.participations) {
            const s = p.tournoi === t.id ? saisies.get(p.joueur) : undefined;
            if (!s) continue;
            p.remarque = s.rem || null;
            const rf = { ...(p.rangForce ?? {}) };
            if (s.rf) rf.Saison = s.rf;
            else delete rf.Saison;
            p.rangForce = Object.keys(rf).length ? rf : undefined;
          }
          const tt = d.tournois.find((x) => x.id === t.id)!;
          if (tt.nbJoueursSeries > joueurs.size) tt.nbJoueursSeries = joueurs.size;
        });
      },
    },
  ]);
}

export function editerJoueur(j?: Joueur) {
  const nomI = h('input', { type: 'text', value: j?.nom ?? '', placeholder: 'Prénom Nom' });
  const court = h('input', { type: 'text', value: j?.nomCourt ?? '', placeholder: 'Surnom affiché' });
  const sexe = h('select', null, h('option', { value: 'h' }, 'Homme'), h('option', { value: 'f' }, 'Femme'));
  sexe.value = j && !j.homme ? 'f' : 'h';
  const rem = h('textarea', { rows: 2 }, j?.remarque ?? '');
  const nbMatchs = j ? matchsDuJoueur(store.data, j.id).length : 0;
  const actions: Parameters<typeof modale>[2] = [];
  if (j && !nbMatchs)
    actions.push({
      texte: 'Supprimer le joueur',
      classe: 'danger',
      action: () => {
        if (nbMatchs) return erreur(`${j.nomCourt} a joué ${nbMatchs} match${nbMatchs > 1 ? 's' : ''} : on ne peut pas le supprimer.`);
        const nbTournois = store.data.participations.filter((p) => p.joueur === j.id).length;
        if (!confirm(`Supprimer ${j.nom}${nbTournois ? ` et ses ${nbTournois} inscription(s) sans match` : ''} ?`)) return false;
        const ok = store.modifier((d) => {
          if (matchsDuJoueur(d, j.id).length) throw new Error(`${j.nomCourt} a des matchs.`);
          d.joueurs = d.joueurs.filter((x) => x.id !== j.id);
          d.participations = d.participations.filter((p) => p.joueur !== j.id);
        });
        if (!ok) return false;
        avis('Joueur supprimé');
        if (location.hash.startsWith('#/j/')) location.hash = '#/joueurs';
      },
    });
  actions.push(
    { texte: 'Annuler', action: () => {} },
    {
      texte: 'Enregistrer',
      classe: 'principal',
      action: () => {
        if (!nomI.value.trim()) return erreur('Le nom est obligatoire.');
        const v = { nom: nomI.value.trim(), nomCourt: court.value.trim() || nomI.value.trim().split(' ')[0], homme: sexe.value === 'h', remarque: rem.value.trim() || null };
        return store.modifier((d) => {
          if (j) Object.assign(d.joueurs.find((x) => x.id === j.id)!, v);
          else d.joueurs.push({ id: Math.max(0, ...d.joueurs.map((x) => x.id)) + 1, ...v });
        });
      },
    },
  );
  modale(
    j ? `Joueur — ${j.nom}` : 'Nouveau joueur',
    h(
      'div',
      { class: 'formulaire' },
      champ('Nom', nomI),
      champ('Surnom', court),
      champ('Sexe', sexe),
      champ('Remarque', rem),
      j && nbMatchs ? h('p', { class: 'discret' }, `🔒 ${nbMatchs} match${nbMatchs > 1 ? 's' : ''} joué${nbMatchs > 1 ? 's' : ''} : ce joueur ne peut pas être supprimé.`) : null,
    ),
    actions,
  );
}
