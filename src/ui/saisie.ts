// Saisie d'un match (port de frm_match)
import { nom, nomCourt } from '../calc';
import { avis, h, modale } from '../dom';
import { blocageMatch } from '../engine/integrite';
import { estBlanchissage, estSupplementaire, scoreParDefaut, scoreValide } from '../engine/regles';
import { maintenantLocal } from '../format';
import type { BockData, Match, TypeMatch } from '../model';
import { store } from '../store';

export interface ContexteSaisie {
  tournoi: number;
  type: TypeMatch;
  joueur1: number;
  joueur2: number;
  /** Pour les tableaux à élimination */
  ronde?: number;
  idMatch?: number;
}

/** Trouve le match correspondant au contexte (paire de joueurs ou position dans le tableau). */
export function trouverMatch(d: BockData, c: ContexteSaisie): Match | undefined {
  return d.matchs.find((m) => {
    if (m.tournoi !== c.tournoi) return false;
    if (c.ronde) return m.ronde === c.ronde && m.idMatch === c.idMatch && (m.type === c.type || (c.type === 'Séries' && m.type === 'Finale') || (c.type === 'Finale' && m.type === 'Séries'));
    return m.type === c.type && ((m.gagnant === c.joueur1 && m.perdant === c.joueur2) || (m.gagnant === c.joueur2 && m.perdant === c.joueur1));
  });
}

export function ouvrirSaisie(c: ContexteSaisie): void {
  const t = store.data.tournois.find((x) => x.id === c.tournoi)!;
  const max = t.pointsGagnants[c.type];
  const existant = trouverMatch(store.data, c);
  const verrou = existant ? blocageMatch(store.data, existant) : undefined;
  const s1Init = existant ? (existant.gagnant === c.joueur1 ? existant.scoreG : existant.scoreP) : '';
  const s2Init = existant ? (existant.gagnant === c.joueur2 ? existant.scoreG : existant.scoreP) : '';
  const dh = existant?.dateHeure || maintenantLocal();

  const in1 = h('input', { type: 'number', min: 0, max: max + 1, value: s1Init, class: 'score', inputmode: 'numeric' });
  const in2 = h('input', { type: 'number', min: 0, max: max + 1, value: s2Init, class: 'score', inputmode: 'numeric' });
  const inDate = h('input', { type: 'date', value: dh.slice(0, 10) });
  const inHeure = h('input', { type: 'time', value: dh.slice(11, 16) });
  const inRem = h('textarea', { rows: 2, placeholder: 'Remarque (facultatif)' }, existant?.remarque ?? '');
  const badges = h('div', { class: 'badges' });
  const message = h('div', { class: 'erreur' });

  const lire = (i: HTMLInputElement) => (i.value === '' ? NaN : Number(i.value));
  const majBadges = () => {
    const a = lire(in1);
    const b = lire(in2);
    badges.replaceChildren();
    message.textContent = '';
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    if (!scoreValide(max, a, b)) message.textContent = `Pointage invalide pour un match à ${max} points`;
    else if (a === 0 && b === 0) badges.append(h('span', { class: 'badge' }, 'Match non joué (sera effacé)'));
    if (estBlanchissage(max, a, b)) badges.append(h('span', { class: 'badge blanchissage' }, 'Blanchissage'));
    if (estSupplementaire(max, a, b)) badges.append(h('span', { class: 'badge supplementaire' }, 'Supplémentaire'));
  };
  const auto = (saisi: HTMLInputElement, autre: HTMLInputElement) => () => {
    const v = lire(saisi);
    if (!Number.isNaN(v)) {
      const d = scoreParDefaut(max, v);
      if (d !== null) autre.value = String(d);
    }
    majBadges();
  };
  in1.addEventListener('input', auto(in1, in2));
  in2.addEventListener('input', auto(in2, in1));
  majBadges();

  const ligne = (j: number, input: HTMLInputElement) =>
    h('div', { class: 'saisie-joueur' }, h('span', { class: 'saisie-nom', title: nom(j) }, nomCourt(j)), input);

  const enregistrer = (a: number, b: number): boolean => {
    if (verrou) {
      avis(verrou, 'erreur');
      return false;
    }
    if (!scoreValide(max, a, b)) {
      message.textContent = `Pointage invalide pour un match à ${max} points`;
      return false;
    }
    return store.modifier((d) => {
      const ex = trouverMatch(d, c);
      d.matchs = d.matchs.filter((m) => m !== ex);
      if (a === 0 && b === 0) return;
      const g1 = a > b;
      const m: Match = {
        tournoi: c.tournoi,
        type: c.type,
        gagnant: g1 ? c.joueur1 : c.joueur2,
        perdant: g1 ? c.joueur2 : c.joueur1,
        scoreG: Math.max(a, b),
        scoreP: Math.min(a, b),
        supplementaire: estSupplementaire(max, a, b),
        blanchissage: estBlanchissage(max, a, b),
        dateHeure: `${inDate.value || maintenantLocal().slice(0, 10)}T${inHeure.value || '00:00'}:00`,
      };
      if (c.ronde) {
        m.ronde = c.ronde;
        m.idMatch = c.idMatch;
      }
      const rem = inRem.value.trim();
      if (rem) m.remarque = rem;
      d.matchs.push(m);
    });
  };

  const actions: Parameters<typeof modale>[2] = [
    { texte: 'Annuler', action: () => {} },
  ];
  if (existant)
    actions.unshift({
      texte: 'Supprimer le match',
      classe: 'danger',
      action: () => (confirm(`Supprimer le match ${nomCourt(existant.gagnant)} ${existant.scoreG}-${existant.scoreP} ${nomCourt(existant.perdant)} ?`) ? enregistrer(0, 0) : false),
    });
  actions.push({ texte: 'Enregistrer', classe: 'principal', action: () => enregistrer(lire(in1), lire(in2)) });

  const titreType = c.type === 'Saison' ? 'Match de saison' : c.type === 'Finale' ? 'Grande finale' : `Match de ${c.type.toLowerCase()}`;
  modale(
    `${titreType} · ${max} de ${2 * max - 1}`,
    h(
      'form',
      { class: 'saisie', onsubmit: (e: Event) => e.preventDefault() },
      verrou ? h('p', { class: 'erreur' }, verrou) : null,
      h('div', { class: 'saisie-scores' }, ligne(c.joueur1, in1), h('span', { class: 'contre' }, 'contre'), ligne(c.joueur2, in2)),
      badges,
      message,
      h('div', { class: 'ligne' }, inDate, inHeure),
      inRem,
    ),
    actions,
  );
  setTimeout(() => in1.focus(), 50);
}
