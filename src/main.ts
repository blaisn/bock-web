import './style.css';
import { h, vider, type Child } from './dom';
import { ilYa } from './format';
import { store, urlDonnees } from './store';
import { pageFace, pageJoueur, pageJoueurs, pageMatchs, pageTournois, pageVie } from './ui/pages';
import { pageHistorique } from './ui/historique';
import { pageReglages } from './ui/reglages';
import { pageTournoi } from './ui/tournoi';

const app = document.getElementById('app')!;
const contenu = h('main', { id: 'contenu' });
const etat = h('div', { class: 'etat' });

const NAV: [string, string][] = [
  ['#/', 'Tournois'],
  ['#/joueurs', 'Joueurs'],
  ['#/vie', 'À vie'],
  ['#/historique', 'Historique'],
  ['#/face', 'Face-à-face'],
  ['#/matchs', 'Matchs'],
  ['#/reglages', '⚙'],
];
const nav = h('nav', { class: 'principale' });

function route(): Child {
  const [, page, a, b, c] = (location.hash || '#/').split('/');
  const n = (x?: string) => (x ? Number(x) : undefined);
  switch (page) {
    case '':
    case undefined:
      return pageTournois();
    case 't':
      return pageTournoi(Number(a), b);
    case 'joueurs':
      return pageJoueurs();
    case 'j':
      return pageJoueur(Number(a));
    case 'vie':
      return pageVie();
    case 'historique':
      return pageHistorique();
    case 'face':
      return pageFace(n(a), n(b));
    case 'matchs':
      return pageMatchs(a, n(b), n(c));
    case 'reglages':
      return pageReglages();
    default:
      return h('p', null, 'Page introuvable.');
  }
}

function majNav() {
  const courant = location.hash.split('/')[1] ?? '';
  vider(
    nav,
    NAV.map(([href, l]) => {
      const p = href.split('/')[1];
      const actif = p === courant || (p === '' && courant === 't') || (p === 'joueurs' && courant === 'j');
      return h('a', { href, class: actif ? 'actif' : '', title: l === '⚙' ? 'Réglages' : undefined }, l);
    }),
  );
}

function majEtat() {
  if (store.saisie) {
    const e = store.etatPublication;
    const cls = e === 'à jour' ? 'ok' : e === 'publication…' ? 'encours' : e === 'non configuré' ? 'neutre' : 'alerte';
    vider(
      etat,
      h('a', { href: '#/reglages', class: `pastille-etat ${cls}`, title: store.erreurPublication ?? 'Poste de saisie' }, '✎ Saisie · ', e === 'à jour' ? 'publié' : e),
      e !== 'à jour' && e !== 'publication…' && e !== 'non configuré' ? h('button', { type: 'button', class: 'mini', onclick: () => void store.publier() }, 'Publier') : null,
    );
  } else {
    vider(etat, h('span', { class: `pastille-etat ${store.erreurLecture ? 'alerte' : 'neutre'}`, title: store.erreurLecture ?? '' }, store.erreurLecture ? 'Hors ligne' : `Mis à jour ${ilYa(store.derniereLecture)}`));
  }
}

/** Lecture seule sans données : on explique pourquoi au lieu d'afficher des pages vides. */
function pageSansDonnees() {
  return h(
    'div',
    { class: 'sans-donnees' },
    h('h1', null, 'Impossible de lire les résultats'),
    h('p', null, 'L’application n’a pas pu récupérer le fichier des résultats :'),
    h('p', null, h('code', null, urlDonnees())),
    h('p', { class: 'erreur-detail' }, store.erreurLecture),
    h(
      'div',
      { class: 'boutons' },
      h('button', { type: 'button', class: 'principal', onclick: () => void store.chargerServeur() }, 'Réessayer'),
      h('a', { href: urlDonnees(), class: 'bouton', target: '_blank', rel: 'noopener' }, 'Ouvrir le fichier directement'),
    ),
    h('p', { class: 'discret' }, 'Une nouvelle tentative est faite automatiquement toutes les 30 secondes.'),
  );
}

/** Erreur JavaScript : affichée à l'écran (utile sur téléphone, sans console). */
function pageErreur(e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  return h(
    'div',
    { class: 'sans-donnees' },
    h('h1', null, 'Erreur d’affichage'),
    h('p', null, 'Une erreur empêche d’afficher cette page. Faites une capture d’écran de ce message :'),
    h('p', { class: 'erreur-detail' }, err.message),
    h('pre', { class: 'pile' }, (err.stack ?? '').split('\n').slice(0, 6).join('\n')),
    h('p', { class: 'discret' }, `${navigator.userAgent} · ${store.data.tournois.length} tournois chargés`),
    h('div', { class: 'boutons' }, h('button', { type: 'button', class: 'principal', onclick: () => location.reload() }, 'Recharger')),
  );
}

// Erreurs hors rendu (ex. au démarrage) : bandeau en haut de page
window.addEventListener('error', (ev) => afficherBandeau(ev.message));
window.addEventListener('unhandledrejection', (ev) => afficherBandeau(String(ev.reason?.message ?? ev.reason)));
function afficherBandeau(message: string) {
  if (document.querySelector('.bandeau-erreur')) return;
  document.body.prepend(h('div', { class: 'bandeau-erreur', role: 'alert' }, '⚠ Erreur : ', message, ' — ', h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); location.reload(); } }, 'recharger')));
}

let dernierHash = '';
function rendre() {
  majNav();
  majEtat();
  const memeePage = location.hash === dernierHash;
  const y = window.scrollX === 0 ? window.scrollY : 0;
  // Conserver le défilement horizontal des grilles lors d'une mise à jour
  const defil = [...contenu.querySelectorAll<HTMLElement>('.defile')].map((e) => e.scrollLeft);
  let page;
  try {
    page = !store.saisie && !store.data.tournois.length && store.erreurLecture ? pageSansDonnees() : route();
  } catch (e) {
    console.error(e);
    page = pageErreur(e);
  }
  vider(contenu, page);
  if (memeePage) {
    window.scrollTo(0, y);
    contenu.querySelectorAll<HTMLElement>('.defile').forEach((e, i) => (e.scrollLeft = defil[i] ?? 0));
  } else window.scrollTo(0, 0);
  dernierHash = location.hash;
}

vider(
  app,
  h('header', null, h('a', { href: '#/', class: 'logo' }, h('span', { class: 'bouchon', 'aria-hidden': 'true' }), 'Bock'), nav, etat),
  contenu,
);

window.addEventListener('hashchange', rendre);
store.abonner(rendre);
setInterval(majEtat, 15_000);

contenu.append(h('p', { class: 'discret' }, 'Chargement…'));
store.demarrer().then(rendre);

// Service worker (mode hors ligne) : seulement sur le site déployé.
// En localhost, il garderait d'anciennes versions en cache entre deux builds : on le désinscrit.
const enLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ('serviceWorker' in navigator) {
  if (enLocal || !import.meta.env.PROD) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => ('caches' in window ? caches.keys() : []))
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith('bock-')).map((k) => caches.delete(k))));
  } else {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non enregistré', e));
  }
}
