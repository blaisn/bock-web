import './style.css';
import { h, vider, type Child } from './dom';
import { ilYa } from './format';
import { store } from './store';
import { pageFace, pageJoueur, pageJoueurs, pageMatchs, pageTournois, pageVie } from './ui/pages';
import { pageReglages } from './ui/reglages';
import { pageTournoi } from './ui/tournoi';

const app = document.getElementById('app')!;
const contenu = h('main', { id: 'contenu' });
const etat = h('div', { class: 'etat' });

const NAV: [string, string][] = [
  ['#/', 'Tournois'],
  ['#/joueurs', 'Joueurs'],
  ['#/vie', 'À vie'],
  ['#/face', 'Face-à-face'],
  ['#/matchs', 'Matchs'],
  ['#/reglages', '⚙'],
];
const nav = h('nav', { class: 'principale' });

function route(): Child {
  const [, page, a, b] = (location.hash || '#/').split('/');
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
    case 'face':
      return pageFace(n(a));
    case 'matchs':
      return pageMatchs(n(a), n(b));
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
      h('span', { class: `pastille-etat ${cls}`, title: 'Poste de saisie' }, '✎ Saisie · ', e === 'à jour' ? 'publié' : e),
      e !== 'à jour' && e !== 'publication…' && e !== 'non configuré' ? h('button', { type: 'button', class: 'mini', onclick: () => void store.publier() }, 'Publier') : null,
    );
  } else {
    vider(etat, h('span', { class: `pastille-etat ${store.erreurLecture ? 'alerte' : 'neutre'}`, title: store.erreurLecture ?? '' }, store.erreurLecture ? 'Hors ligne' : `Mis à jour ${ilYa(store.derniereLecture)}`));
  }
}

let dernierHash = '';
function rendre() {
  majNav();
  majEtat();
  const memeePage = location.hash === dernierHash;
  const y = window.scrollX === 0 ? window.scrollY : 0;
  // Conserver le défilement horizontal des grilles lors d'une mise à jour
  const defil = [...contenu.querySelectorAll<HTMLElement>('.defile')].map((e) => e.scrollLeft);
  vider(contenu, route());
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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non enregistré', e));
}
