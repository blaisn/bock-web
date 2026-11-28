// Historique : carte de chaleur joueurs × tournois
import { type EtapeParcours, HORS_SERIES, NIVEAUX_SERIES, nom, nomCourt, parcoursJoueur, statsVie, tournoisRecentsDabord } from '../calc';
import { h, type Child } from '../dom';
import { store } from '../store';
import { iconeConsolation, lienJoueur, titre } from './commun';

type Mode = 'saison' | 'series';
type Tri = 'debut' | 'participations' | 'rang' | 'nom';
const etat: { mode: Mode; tri: Tri; min: number } = { mode: 'saison', tri: 'debut', min: 2 };

/** Rampe séquentielle (une teinte, du foncé = meilleur au pâle = moins bon) */
const RAMPE = ['#5c3606', '#8a560d', '#b57d26', '#d6a95a', '#ead09a', '#f6e9cf'];
const TEXTE_CLAIR = 3; // les 3 premières cases ont un texte clair

const ordinal = (r: number) => (r === 1 ? '1er' : `${r}e`);

/** Case de couleur 0 (meilleur) à 5 (moins bon) */
function niveauCouleur(e: EtapeParcours, mode: Mode): number | undefined {
  if (!e.present) return undefined;
  if (mode === 'series') return e.niveauSeries;
  const n = e.norm!;
  if (e.rang === 1) return 0;
  if (n >= 75) return 1;
  if (n >= 50) return 2;
  if (n >= 25) return 3;
  if (n > 0) return 4;
  return 5;
}

const ABREV_SERIES = ['', 'F', 'D', 'Q', 'H', ''];

function contenu(e: EtapeParcours, mode: Mode): Child {
  if (mode === 'saison') return e.champSaison ? '★' : String(e.rang);
  if (e.champSeries) return '🏆';
  if (e.champConsolation) return iconeConsolation('Champion de la consolation');
  return e.niveauSeries === undefined ? '?' : ABREV_SERIES[e.niveauSeries];
}

function infobulle(e: EtapeParcours): string {
  const t = e.tournoi;
  const l = [`${t.date.slice(0, 4)} · ${t.lieu}`];
  if (!e.present) return `${l[0]}\nAbsent`;
  l.push(`Saison : ${ordinal(e.rang!)} sur ${e.nbParticipants}${e.champSaison ? ' ★ champion' : ''}`);
  if (e.niveauSeries !== undefined) l.push(e.niveauSeries === HORS_SERIES ? 'Séries : non qualifié' : `Séries : ${NIVEAUX_SERIES[e.niveauSeries].toLowerCase()}${e.champSeries ? ' 🏆' : ''}`);
  if (e.champConsolation) l.push('Champion de la consolation 🚽');
  return l.join('\n');
}

export function pageHistorique(): Child {
  const zone = h('div');
  const tournois = [...tournoisRecentsDabord()].reverse();

  const rendre = () => {
    const stats = new Map(statsVie({ types: ['Saison', 'Séries', 'Consolation', 'Finale'] }).map((s) => [s.joueur, s]));
    let joueurs = store.data.joueurs
      .map((j) => ({ j, parcours: parcoursJoueur(j.id), s: stats.get(j.id) }))
      .filter((x) => (x.s?.participations ?? 0) >= etat.min);
    const debut = (x: (typeof joueurs)[number]) => x.parcours.findIndex((e) => e.present);
    joueurs.sort((a, b) => {
      switch (etat.tri) {
        case 'participations':
          return (b.s?.participations ?? 0) - (a.s?.participations ?? 0) || debut(a) - debut(b);
        case 'rang':
          return (a.s?.rangMoyen ?? 99) - (b.s?.rangMoyen ?? 99);
        case 'nom':
          return a.j.nomCourt.localeCompare(b.j.nomCourt, 'fr');
        default:
          return debut(a) - debut(b) || (b.s?.participations ?? 0) - (a.s?.participations ?? 0);
      }
    });

    zone.replaceChildren(
      h(
        'div',
        { class: 'defile' },
        h(
          'table',
          { class: 'chaleur' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { class: 'ch-joueur' }, 'Joueur'),
              h('th', { class: 'ch-nb', title: 'Participations' }, 'T.'),
              tournois.map((t) => h('th', { title: `${t.date.slice(0, 4)} · ${t.lieu}` }, h('a', { href: `#/t/${t.id}` }, t.date.slice(2, 4)))),
            ),
          ),
          h(
            'tbody',
            null,
            joueurs.map(({ j, parcours, s }) =>
              h(
                'tr',
                null,
                h('th', { class: 'ch-joueur', title: nom(j.id) }, lienJoueur(j.id)),
                h('td', { class: 'ch-nb' }, s?.participations ?? 0),
                parcours.map((e) => {
                  const c = niveauCouleur(e, etat.mode);
                  if (!e.present) return h('td', { class: 'ch-absent', title: infobulle(e) });
                  return h(
                    'td',
                    {
                      class: `ch-case ${c !== undefined && c < TEXTE_CLAIR ? 'clair' : ''}`,
                      style: { background: c === undefined ? 'var(--nonjoue)' : RAMPE[c] },
                      title: `${nomCourt(j.id)} — ${infobulle(e)}`,
                      onclick: () => (location.hash = `#/t/${e.tournoi.id}`),
                    },
                    contenu(e, etat.mode),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
      h('div', null, legende(etat.mode)),
    );
  };

  const choix = <T extends string>(valeur: T, options: [T, string][], change: (v: T) => void) =>
    h('select', { onchange: (e: Event) => change((e.target as HTMLSelectElement).value as T) }, options.map(([v, l]) => h('option', { value: v, selected: v === valeur }, l)));

  rendre();
  return h(
    'div',
    null,
    titre('Historique'),
    h('p', { class: 'discret' }, 'Chaque case est un tournoi : plus elle est foncée, meilleur est le résultat. Survolez une case pour le détail, cliquez pour ouvrir le tournoi.'),
    h(
      'div',
      { class: 'filtres' },
      h('label', null, 'Couleur selon ', choix<Mode>(etat.mode, [['saison', 'le rang de saison'], ['series', 'le résultat en séries']], (v) => { etat.mode = v; rendre(); })),
      h('label', null, 'Trier par ', choix<Tri>(etat.tri, [['debut', 'première participation'], ['participations', 'nombre de tournois'], ['rang', 'rang moyen'], ['nom', 'surnom']], (v) => { etat.tri = v; rendre(); })),
      h('label', null, 'Min. tournois ', h('input', { type: 'number', min: 1, max: 40, value: etat.min, class: 'court', oninput: (e: Event) => { etat.min = Number((e.target as HTMLInputElement).value) || 1; rendre(); } })),
    ),
    zone,
  );
}

function legende(mode: Mode): Child {
  const libelles =
    mode === 'saison'
      ? ['1er', 'quart supérieur', '2e quart', '3e quart', 'dernier quart', 'dernier']
      : ['Champion', 'Finaliste (F)', 'Demi (D)', 'Quart (Q)', 'Huitième (H)', 'Hors séries'];
  return h(
    'div',
    { class: 'ch-legende' },
    libelles.map((l, i) => h('span', null, h('i', { style: { background: RAMPE[i] } }), l)),
    h('span', null, h('i', { class: 'absent' }), 'absent'),
    h('span', { class: 'discret' }, mode === 'saison' ? '★ champion de saison · le chiffre = rang' : ['🏆 champion des séries · ', iconeConsolation(), ' champion de la consolation · ? résultat inconnu (séries perdues en 1992)']),
  );
}
