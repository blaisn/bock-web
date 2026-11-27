# Bock — version web

Gestion du tournoi annuel de lancer de bouchons : saison à la ronde (3 de 5), séries éliminatoires (grande finale 4 de 7) et consolation. Il s'agit de la reprise du logiciel MS Access `Bock_win v22`, avec les 38 tournois importés.

- **Site statique** (TypeScript + Vite, sans framework) hébergé dans un bucket S3.
- **Un poste de saisie** (le PC) : les données vivent dans son navigateur et sont publiées dans le bucket (`bock.json`).
- **Téléphones en lecture seule** : ils relisent `bock.json` toutes les 30 secondes.
- **Sans wifi** : le PC continue de fonctionner (service worker + stockage local). La publication reprend d'elle-même au retour du réseau.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # moteur + validation contre l'historique Access
npm run build      # dist/
```

`npm test` recalcule les classements des 38 tournois et les compare aux valeurs calculées par Access (`data-import/access-valeurs.json`). Les seuls écarts tolérés sont documentés dans `test/historique.test.ts`.

## Structure

| Dossier | Contenu |
| --- | --- |
| `src/engine/` | Moteur sans interface : fiches, bris d'égalité, classement, meilleur et pire rang, tableau éliminatoire, règles de pointage |
| `src/ui/` | Pages et formulaires |
| `src/store.ts` | Stockage local, lecture de `bock.json`, publication S3 (signature AWS v4 via `aws4fetch`) |
| `data-import/` | Données exportées d'Access (`bock.json`) et valeurs de référence pour les tests |
| `public/bock.json` | Données initiales, déployées une seule fois |
| `aws/` | Politiques IAM et bucket, configuration CORS |

## Les fichiers `bock.json`

Il existe quatre copies des données, chacune avec un rôle précis.

| Copie | Rôle | Qui l'écrit |
| --- | --- | --- |
| `data-import/bock.json` | **Référence de la conversion Access.** Utilisée seulement par les tests, avec `access-valeurs.json`. | Le script d'export, une fois. L'application ne l'écrit jamais. |
| `public/bock.json` | **Données de départ du site.** Copie identique de `data-import/bock.json`, copiée dans `dist/` au build. | Personne, sauf pour réinitialiser l'historique. |
| `bock.json` dans le bucket | **Copie officielle partagée**, lue par les téléphones toutes les 30 secondes. | `deployer.sh --avec-donnees` (premier déploiement), puis le PC de saisie à chaque publication. |
| Stockage du navigateur (`localStorage`, clé `bock.donnees`) | **Copie de travail du poste de saisie.** C'est elle qui fait foi. | Chaque saisie sur le PC. Elle est publiée ensuite vers le bucket. |

À noter :

- **Conversion intacte** : c'est `data-import/bock.json`. Une seule retouche y a été faite à la main : les champions inscrits (`championsInscrits`) de 4 tournois (1987, 1989, 1990, 2025), pour reproduire ce qu'Access affichait. La source vraiment brute reste le fichier `.mdb`.
- **Le stockage du navigateur est propre à chaque adresse** (protocole + domaine + port). L'adresse https du bucket, `http://localhost:5173` et `http://localhost:4173` ont chacune leur copie, indépendante des autres.
- **Premier lancement du mode saisie** : la copie de travail est initialisée à partir du `bock.json` servi par l'adresse courante.

### En localhost

| Commande | Fichier lu par l'application |
| --- | --- |
| `npm run dev` (port 5173) | `public/bock.json` |
| `npm run preview` (port 4173) | `dist/bock.json`, copié de `public/` au build |

- **En lecture seule**, l'application lit ce fichier local, donc l'historique Access, et non les résultats du bucket.
- **En mode saisie**, elle en fait une copie dans le stockage de localhost et ne travaille ensuite qu'avec cette copie. Les changements restent en localhost.

> ⚠️ Si vous entrez les clés S3 dans les Réglages de localhost, la publication enverra cette copie de test dans le vrai bucket et **écrasera les résultats officiels**. En développement, laissez les Réglages S3 vides, ou décochez « Publier automatiquement ».

Pour travailler en développement avec les vraies données : sur le PC de saisie, ⚙ Réglages → « Télécharger une sauvegarde », puis en localhost, ⚙ Réglages → « Restaurer une sauvegarde ».

### Circuit en production

```
data-import ──(copie)──► public ──(build + --avec-donnees, 1 fois)──► bucket
                                                                        │
                    PC de saisie (localStorage) ◄──(1er lancement)──────┘
                              │
                              └──(publication à chaque saisie)──► bucket ──► téléphones
```

Les déploiements suivants (`scripts/deployer.sh NOM-DU-BUCKET`, sans `--avec-donnees`) n'envoient jamais `bock.json` : les résultats publiés par le PC ne sont pas touchés.

## Règles reprises d'Access

- **Classement de saison** :
  1. victoires, puis défaites ;
  2. différentiel, si l'option « différentiel avant PP » est cochée ;
  3. points pour, puis points contre ;
  4. fiche relative (matchs entre les joueurs à égalité seulement) ;
  5. blanchissages (courants, puis relatifs) ;
  6. supplémentaires (courants, puis relatifs) ;
  7. fiche à vie des tournois antérieurs.
  
  Un **rang forcé** peut remplacer le rang calculé.
- **Statuts** : C = champion assuré, s = assuré des séries, X = éliminé. Ils sont calculés à partir des fiches minimale et maximale encore possibles.
- **Séries** : tableau de placement 1-8, 4-5, 2-7, 3-6. Il est complété jusqu'à la puissance de 2 suivante, avec des laissez-passer quand il manque des joueurs. Le dernier match est la **Finale**.
- **Consolation** : même tableau pour les joueurs classés après les séries. S'il y a moins de deux joueurs, il n'y a pas de consolation.
- **Pointages** : `max` contre 0 à `max-1`, ou `max+1` contre `max` (supplémentaire). Un 0-0 efface le match.

## Intégrité des données

Les contraintes de la base Access (clés primaires, index uniques, relations) sont reprises dans `src/engine/integrite.ts` :

| Access | Version web |
| --- | --- |
| Clés primaires joueurs et tournois | Identifiants uniques |
| `idx_TournoiJoueur` | Une seule inscription par joueur et par tournoi |
| Participations → Joueurs, Tournois | Le joueur et le tournoi doivent exister |
| Matchs → Participations | Gagnant et perdant inscrits au tournoi |
| `idx_Unicité` | Un seul match par paire de joueurs (ronde) |
| `idx_Éliminatoire` | Un seul match par position du tableau |
| `ValideScore` (VBA) | Pointage valide, blanchissage et supplémentaire cohérents |

La vérification s'applique à quatre endroits :
- **chaque modification** : c'est une transaction, et une modification qui viole une contrainte est annulée avec la liste des problèmes ;
- **le chargement** de `bock.json` ;
- **la restauration** d'une sauvegarde, qui est refusée si le fichier est incohérent ;
- **chaque publication**, qui est bloquée si les données sont incohérentes.

Règles de suppression :
- **Joueur** : seulement s'il n'a joué aucun match. Ses inscriptions sans match sont retirées avec lui.
- **Tournoi** : seulement s'il n'a aucun match. Il faut d'abord supprimer ses matchs, depuis la fenêtre de saisie ou l'onglet Matchs.
- **Participant** : il ne peut pas être décoché s'il a joué au moins un match dans le tournoi.
- **Match des séries ou de la consolation** : il ne peut pas être supprimé ni modifié si le match suivant du tableau est déjà joué.

Le calcul du CAS et les données qui le servaient (poids, volume, alcool) n'ont pas été repris.

## Mise en ligne sur S3

1. **Créer le bucket**, par exemple dans `ca-central-1`. Désactiver « Bloquer l'accès public », puis appliquer `aws/politique-bucket.json` (lecture publique) après avoir remplacé `NOM-DU-BUCKET`.
2. **Ajouter le CORS** (`aws/cors.json`). Il n'est requis que si le site est servi depuis une autre adresse que `https://NOM-DU-BUCKET.s3.REGION.amazonaws.com`, par exemple le point de terminaison « website » ou CloudFront.
3. **Premier déploiement**, qui envoie aussi les données historiques :
   ```bash
   scripts/deployer.sh NOM-DU-BUCKET --avec-donnees
   ```
   Pour les déploiements suivants, omettre `--avec-donnees` : sinon les résultats publiés par le PC seraient écrasés.
4. **Adresse à utiliser** : `https://NOM-DU-BUCKET.s3.REGION.amazonaws.com/index.html`. Elle est en HTTPS, ce qui est nécessaire au fonctionnement hors ligne, et c'est la même origine que la publication, donc aucun CORS n'est requis.
5. **Clé de publication** : créer un utilisateur IAM avec la seule politique `aws/politique-publication.json` (`s3:PutObject` sur `bock.json`), puis générer une clé d'accès.
6. **Sur le PC de saisie** : ouvrir le site, aller dans ⚙ Réglages, cliquer « Activer le mode saisie », puis entrer le bucket, la région et la clé. Cliquer « Enregistrer et publier ».

La clé IAM est conservée dans le navigateur du PC seulement. Comme sa seule permission est d'écrire `bock.json`, une fuite ne permettrait, au pire, que de remplacer les résultats. Téléchargez une sauvegarde de temps en temps (⚙ Réglages → « Télécharger une sauvegarde »).

## Le soir du tournoi

- **PC** : ouvrir le site au moins une fois avant de perdre le réseau, pour que le service worker le mette en cache. Toute la saisie se fait ensuite sur le PC.
- **Téléphones** : ouvrir l'adresse du site. La pastille en haut à droite indique l'heure de la dernière mise à jour.
- **Sans réseau du tout** : le PC fonctionne normalement. La pastille indique « hors ligne » et la publication se fait au retour du réseau, ou par le bouton « Publier ».
- **Copie 100 % locale** (ex. `npm run preview` sur le PC) : c'est une autre adresse, donc un autre stockage. Transférez les données avec « Télécharger une sauvegarde » puis « Restaurer une sauvegarde ».
