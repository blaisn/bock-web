// Service worker : permet au poste de saisie de fonctionner sans connexion.
// - bock.json et index.html : réseau d'abord, cache en secours
// - autres fichiers (JS, CSS, icônes) : cache d'abord
// Changer ce numéro purge les anciens caches chez tous les utilisateurs
const CACHE = 'bock-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './favicon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const reseauDabord = req.mode === 'navigate' || url.pathname.endsWith('/bock.json') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (reseauDabord) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copie = r.clone();
            const cle = url.pathname.endsWith('/bock.json') ? new Request(url.origin + url.pathname) : req;
            caches.open(CACHE).then((c) => c.put(cle, copie));
          }
          return r;
        })
        .catch(() => caches.match(url.pathname.endsWith('/bock.json') ? new Request(url.origin + url.pathname) : req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
    );
  } else {
    e.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req)
            .then((rep) => {
              if (rep.ok) {
                const copie = rep.clone();
                caches.open(CACHE).then((c) => c.put(req, copie));
              }
              return rep;
            })
            // Ni en cache ni sur le réseau : réponse d'erreur propre plutôt qu'une promesse rejetée
            .catch(() => Response.error()),
      ),
    );
  }
});
