// Réglages : mode saisie, publication S3, sauvegarde / restauration
import { avis, h, modale, type Child } from '../dom';
import { dateCourte, ilYa } from '../format';
import type { BockData } from '../model';
import { verifierIntegrite } from '../engine/integrite';
import { signalerErreurs, store } from '../store';
import { champ, titre } from './commun';

export function pageReglages(): Child {
  const d = store.data;
  const resume = `${d.tournois.length} tournois · ${d.joueurs.length} joueurs · ${d.matchs.length} matchs · modifié ${d.modifie ? ilYa(d.modifie) : '—'}`;

  if (!store.saisie) {
    return h(
      'div',
      null,
      titre('Réglages'),
      h('p', null, 'Cet appareil est en ', h('b', null, 'lecture seule'), ' : il affiche les résultats publiés et se met à jour automatiquement toutes les 30 secondes.'),
      h('p', { class: 'discret' }, resume, store.derniereLecture ? ` · dernière lecture ${ilYa(store.derniereLecture)}` : '', store.erreurLecture ? ` · erreur : ${store.erreurLecture}` : ''),
      h('h2', null, 'Sauvegarde'),
      h('div', { class: 'boutons' }, h('button', { type: 'button', onclick: exporter }, 'Télécharger les données (JSON)')),
      h(
        'details',
        { class: 'avance' },
        h('summary', null, 'Réservé à l’organisateur : poste de saisie'),
        h(
          'p',
          { class: 'avertissement' },
          'À activer seulement sur le PC qui enregistre les résultats. Sur un téléphone de participant, ne l’activez pas : ',
          'l’appareil cesserait d’afficher les résultats publiés et montrerait sa propre copie.',
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: !store.data.tournois.length,
            title: store.data.tournois.length ? '' : 'Les données publiées doivent d’abord être chargées',
            onclick: () =>
              modale('Activer la saisie sur cet appareil ?', h('p', null, 'Les données publiées seront copiées dans ce navigateur, qui deviendra le poste de saisie. N’activez ce mode que sur le PC de l’organisateur.'), [
                { texte: 'Annuler', action: () => {} },
                { texte: 'Activer', classe: 'principal', action: () => store.activerSaisie(true) },
              ]),
          },
          'Activer le mode saisie',
        ),
      ),
    );
  }

  const s3 = store.config.s3;
  const bucket = h('input', { type: 'text', value: s3?.bucket ?? '', placeholder: 'mon-bucket-bock' });
  const region = h('input', { type: 'text', value: s3?.region ?? 'ca-central-1' });
  const cle = h('input', { type: 'text', value: s3?.cle ?? 'bock.json' });
  const akid = h('input', { type: 'text', value: s3?.accessKeyId ?? '', autocomplete: 'off' });
  const secret = h('input', { type: 'password', value: s3?.secretAccessKey ?? '', autocomplete: 'off' });
  const auto = h('input', { type: 'checkbox', checked: store.config.autoPublier });

  return h(
    'div',
    null,
    titre('Réglages'),
    h('p', null, 'Cet appareil est le ', h('b', null, 'poste de saisie'), '. Les données sont conservées dans ce navigateur, même sans connexion.'),
    !store.config.s3
      ? h(
          'p',
          { class: 'avertissement' },
          'La publication n’est pas configurée. Si cet appareil n’est pas le PC de l’organisateur, repassez en lecture seule pour voir les résultats publiés : ',
          h('button', { type: 'button', class: 'mini', onclick: () => store.activerSaisie(false) }, 'Repasser en lecture seule'),
        )
      : null,
    h('p', { class: 'discret' }, resume),
    store.erreursLocales.length
      ? h('p', { class: 'avertissement' }, `${store.erreursLocales.length} problème(s) d’intégrité dans les données de ce navigateur : la publication est bloquée. `, h('button', { type: 'button', class: 'mini', onclick: () => signalerErreurs('Problèmes d’intégrité', store.erreursLocales) }, 'Voir'))
      : null,
    h('h2', null, 'Publication dans S3'),
    h(
      'p',
      { class: 'discret' },
      'Utilisez une clé IAM dont la seule permission est s3:PutObject sur ce fichier. ',
      'Elle est conservée dans ce navigateur seulement.',
    ),
    h('div', { class: 'formulaire' }, champ('Bucket', bucket), champ('Région', region), champ('Fichier publié', cle, 'Le fichier bock.json à côté de index.html'), champ('Access key ID', akid), champ('Secret access key', secret)),
    h('label', { class: 'case-a-cocher' }, auto, ' Publier automatiquement après chaque modification'),
    h(
      'div',
      { class: 'boutons' },
      h(
        'button',
        {
          type: 'button',
          class: 'principal',
          onclick: async () => {
            const v = { bucket: bucket.value.trim(), region: region.value.trim(), cle: cle.value.trim() || 'bock.json', accessKeyId: akid.value.trim(), secretAccessKey: secret.value.trim() };
            store.sauverConfig({ s3: v.bucket && v.accessKeyId && v.secretAccessKey ? v : undefined, autoPublier: auto.checked });
            if (!store.config.s3) return avis('Réglages enregistrés (publication désactivée).');
            if (await store.publier()) avis('Publication réussie ✔');
            else avis('Publication échouée — voir le message sous le bouton', 'erreur');
          },
        },
        'Enregistrer et publier',
      ),
    ),
    store.erreurPublication ? h('p', { class: 'avertissement' }, h('b', null, 'Échec de la publication : '), store.erreurPublication) : null,
    !store.erreurPublication && (!window.isSecureContext || !globalThis.crypto?.subtle)
      ? h('p', { class: 'avertissement' }, 'Cette page est ouverte en http : la publication et le mode hors ligne exigent l’adresse https du bucket (…s3.REGION.amazonaws.com/index.html).')
      : null,
    store.config.dernierePublication ? h('p', { class: 'discret' }, `Dernière publication : ${ilYa(store.config.dernierePublication)} (${dateCourte(store.config.dernierePublication)})`) : null,
    h('h2', null, 'Sauvegardes'),
    h(
      'div',
      { class: 'boutons' },
      h('button', { type: 'button', onclick: exporter }, 'Télécharger une sauvegarde (JSON)'),
      h('label', { class: 'bouton' }, 'Restaurer une sauvegarde…', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: importer })),
      h(
        'button',
        {
          type: 'button',
          onclick: () =>
            modale('Recharger les données publiées ?', h('p', null, 'Les données de ce navigateur seront remplacées par le fichier publié sur le serveur. Les modifications non publiées seront perdues.'), [
              { texte: 'Annuler', action: () => {} },
              {
                texte: 'Recharger',
                classe: 'danger',
                action: async () => {
                  const data = store.data;
                  store.data = { ...data, modifie: 'force' };
                  if (await store.chargerServeur()) avis('Données rechargées');
                  else {
                    store.data = data;
                    avis('Serveur inaccessible', 'erreur');
                  }
                },
              },
            ]),
        },
        'Recharger depuis le serveur',
      ),
    ),
    h('h2', null, 'Mode'),
    h('button', { type: 'button', onclick: () => confirm('Repasser cet appareil en lecture seule ? Les données non publiées resteront dans ce navigateur mais ne seront plus affichées.') && store.activerSaisie(false) }, 'Repasser en lecture seule'),
  );
}

function exporter() {
  const blob = new Blob([JSON.stringify(store.data, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `bock-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importer(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const d = JSON.parse(await f.text()) as BockData;
    const erreurs = verifierIntegrite(d);
    if (erreurs.length) return signalerErreurs(`Sauvegarde refusée : ${erreurs.length} problème(s) d’intégrité`, erreurs);
    modale('Restaurer cette sauvegarde ?', h('p', null, `${d.tournois.length} tournois, ${d.matchs.length} matchs. Les données actuelles seront remplacées.`), [
      { texte: 'Annuler', action: () => {} },
      {
        texte: 'Restaurer',
        classe: 'danger',
        action: () => {
          const refus = store.remplacer(d);
          if (refus.length) {
            signalerErreurs('Sauvegarde refusée', refus);
            return;
          }
          if (store.config.autoPublier) void store.publier();
          avis('Sauvegarde restaurée');
        },
      },
    ]);
  } catch {
    avis('Fichier invalide (JSON illisible)', 'erreur');
  } finally {
    (e.target as HTMLInputElement).value = '';
  }
}
