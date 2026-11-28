// Données et publication
//  - PC de saisie (« mode saisie ») : les données vivent dans le navigateur (localStorage)
//    et sont publiées dans le bucket S3 (bock.json).
//  - Téléphones (lecture seule) : relisent bock.json périodiquement.

import { AwsClient } from 'aws4fetch';
import { h, modale } from './dom';
import { verifierIntegrite } from './engine/integrite';
import type { BockData } from './model';

const CLE_DONNEES = 'bock.donnees';
const CLE_CONFIG = 'bock.config';
const URL_DONNEES = 'bock.json';
const INTERVALLE_LECTURE_MS = 30_000;

/** Affiche la liste des violations d'intégrité. */
export function signalerErreurs(titre: string, erreurs: string[]): void {
  const max = 15;
  modale(
    titre,
    h(
      'div',
      null,
      h('ul', { class: 'erreurs' }, erreurs.slice(0, max).map((x) => h('li', null, x))),
      erreurs.length > max ? h('p', { class: 'discret' }, `… et ${erreurs.length - max} autre(s).`) : null,
    ),
    [{ texte: 'OK', classe: 'principal', action: () => {} }],
  );
}

export interface ConfigS3 {
  bucket: string;
  region: string;
  /** Clé de l'objet dans le bucket (ex. bock.json ou dossier/bock.json) */
  cle: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface Config {
  saisie: boolean;
  autoPublier: boolean;
  s3?: ConfigS3;
  /** Horodatage des données publiées en dernier */
  dernierePublication?: string;
  /** Horodatage des données lors de la dernière publication réussie */
  versionPubliee?: string;
}

/** Traduit une réponse d'erreur S3 (XML) en message lisible. */
function messageS3(statut: number, corps: string): string {
  const code = /<Code>([^<]+)<\/Code>/.exec(corps)?.[1];
  const msg = /<Message>([^<]+)<\/Message>/.exec(corps)?.[1];
  const aide: Record<string, string> = {
    AccessDenied: 'la clé IAM n’a pas le droit d’écrire ce fichier (vérifiez la politique et le champ « Fichier publié »)',
    SignatureDoesNotMatch: 'la clé secrète est incorrecte',
    InvalidAccessKeyId: 'l’Access key ID est inconnu',
    AuthorizationHeaderMalformed: 'la région saisie n’est pas celle du bucket',
    PermanentRedirect: 'la région saisie n’est pas celle du bucket',
    RequestTimeTooSkewed: 'l’horloge de cet ordinateur est décalée',
    NoSuchBucket: 'ce bucket n’existe pas',
  };
  return `HTTP ${statut}${code ? ` ${code}` : ''}${code && aide[code] ? ` : ${aide[code]}` : msg ? ` : ${msg}` : ''}`;
}

export type EtatPublication = 'à jour' | 'non publié' | 'publication…' | 'erreur' | 'hors ligne' | 'non configuré';

type Ecouteur = () => void;

function lireJSON<T>(cle: string): T | null {
  try {
    const s = localStorage.getItem(cle);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function ecrireJSON(cle: string, v: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch (e) {
    console.error('Écriture localStorage impossible', e);
  }
}

/** Adresse complète du fichier de données lu par les téléphones */
export const urlDonnees = () => new URL(URL_DONNEES, location.href).href;

class Store {
  data: BockData = { version: 1, joueurs: [], tournois: [], participations: [], matchs: [] };
  config: Config = lireJSON<Config>(CLE_CONFIG) ?? { saisie: false, autoPublier: true };
  /** Incrémenté à chaque changement (sert d'invalidation des caches) */
  revision = 0;
  etatPublication: EtatPublication = 'à jour';
  /** Message de la dernière publication échouée */
  erreurPublication?: string;
  derniereLecture?: string;
  erreurLecture?: string;
  /** Violations détectées dans les données locales au démarrage (publication bloquée) */
  erreursLocales: string[] = [];
  private ecouteurs = new Set<Ecouteur>();
  private minuterie?: number;

  get saisie(): boolean {
    return this.config.saisie;
  }

  abonner(f: Ecouteur): () => void {
    this.ecouteurs.add(f);
    return () => this.ecouteurs.delete(f);
  }

  private notifier(): void {
    this.revision++;
    for (const f of this.ecouteurs) f();
  }

  async demarrer(): Promise<void> {
    if (this.saisie) {
      const local = lireJSON<BockData>(CLE_DONNEES);
      // Une copie locale vide (ex. saisie activée avant le chargement) ne compte pas : on relit le serveur
      if (local?.tournois?.length) {
        this.data = local;
        this.erreursLocales = verifierIntegrite(local);
        if (this.erreursLocales.length)
          setTimeout(() => signalerErreurs('Données locales incohérentes — publication bloquée', this.erreursLocales), 300);
      } else await this.chargerServeur();
      this.majEtat();
    } else {
      await this.chargerServeur();
      this.minuterie = window.setInterval(() => void this.chargerServeur(true), INTERVALLE_LECTURE_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.chargerServeur(true);
      });
    }
  }

  /** Lit bock.json sur le serveur. */
  async chargerServeur(silencieux = false): Promise<boolean> {
    try {
      let r: Response;
      try {
        r = await fetch(`${URL_DONNEES}?t=${Date.now()}`, { cache: 'no-store' });
      } catch {
        throw new Error('pas de connexion, ou requête bloquée par le navigateur');
      }
      if (!r.ok) {
        const raisons: Record<number, string> = {
          403: 'accès refusé : le fichier n’est pas lisible publiquement (politique du bucket ?)',
          404: 'fichier introuvable : bock.json n’est pas à côté de index.html',
        };
        throw new Error(`HTTP ${r.status} — ${raisons[r.status] ?? 'erreur du serveur'}`);
      }
      let d: BockData;
      try {
        d = (await r.json()) as BockData;
      } catch {
        throw new Error('le fichier n’est pas un JSON valide');
      }
      const erreurs = verifierIntegrite(d);
      if (erreurs.length) {
        console.warn('bock.json invalide', erreurs);
        // Sans données du tout, mieux vaut afficher quelque chose ; sinon on garde les précédentes
        if (this.data.tournois.length) throw new Error(`données publiées invalides (${erreurs[0]})`);
      }
      this.derniereLecture = new Date().toISOString();
      this.erreurLecture = undefined;
      if (d.modifie !== this.data.modifie || !this.data.tournois.length) {
        this.data = d;
        this.erreursLocales = erreurs;
        if (this.saisie) ecrireJSON(CLE_DONNEES, d);
        this.notifier();
      } else if (!silencieux) {
        this.notifier();
      }
      return true;
    } catch (e) {
      this.erreurLecture = e instanceof Error ? e.message : String(e);
      if (!silencieux) this.notifier();
      return false;
    }
  }

  /**
   * Modifie les données comme une transaction (mode saisie seulement) :
   * si une contrainte d'intégrité est violée, rien n'est changé.
   * Retourne true si la modification est enregistrée.
   */
  modifier(f: (d: BockData) => void): boolean {
    if (!this.saisie) throw new Error('Lecture seule');
    const copie = structuredClone(this.data);
    try {
      f(copie);
    } catch (e) {
      signalerErreurs('Modification refusée', [String(e instanceof Error ? e.message : e)]);
      return false;
    }
    // Les erreurs déjà présentes au démarrage ne bloquent pas les nouvelles modifications
    const avant = new Set(this.erreursLocales);
    const nouvelles = verifierIntegrite(copie).filter((x) => !avant.has(x));
    if (nouvelles.length) {
      signalerErreurs('Modification refusée', nouvelles);
      return false;
    }
    this.data = copie;
    this.erreursLocales = this.erreursLocales.length ? verifierIntegrite(copie) : [];
    this.data.modifie = new Date().toISOString();
    ecrireJSON(CLE_DONNEES, this.data);
    this.majEtat();
    this.notifier();
    if (this.config.autoPublier) void this.publier();
    return true;
  }

  /** Remplace toutes les données (restauration). Retourne les violations, vide si accepté. */
  remplacer(d: BockData): string[] {
    const erreurs = verifierIntegrite(d);
    if (erreurs.length) return erreurs;
    this.erreursLocales = [];
    this.data = d;
    this.data.modifie = new Date().toISOString();
    ecrireJSON(CLE_DONNEES, this.data);
    this.majEtat();
    this.notifier();
    return [];
  }

  sauverConfig(c: Partial<Config>): void {
    this.config = { ...this.config, ...c };
    ecrireJSON(CLE_CONFIG, this.config);
    this.majEtat();
    this.notifier();
  }

  activerSaisie(oui: boolean): void {
    this.sauverConfig({ saisie: oui });
    // N'enregistrer comme copie de travail que des données réellement chargées ;
    // sinon le prochain démarrage relira le serveur
    if (oui && this.data.tournois.length) ecrireJSON(CLE_DONNEES, this.data);
    else if (oui) localStorage.removeItem(CLE_DONNEES);
    location.reload();
  }

  private majEtat(): void {
    if (!this.saisie) return;
    if (!this.config.s3) this.etatPublication = 'non configuré';
    else if (this.config.versionPubliee === this.data.modifie) this.etatPublication = 'à jour';
    else if (!navigator.onLine) this.etatPublication = 'hors ligne';
    else if (this.etatPublication !== 'publication…') this.etatPublication = 'non publié';
  }

  private enCours?: Promise<boolean>;

  async publier(): Promise<boolean> {
    if (this.enCours) {
      await this.enCours;
      if (this.config.versionPubliee === this.data.modifie) return true;
    }
    this.enCours = this.publierMaintenant();
    try {
      return await this.enCours;
    } finally {
      this.enCours = undefined;
    }
  }

  private async publierMaintenant(): Promise<boolean> {
    const s3 = this.config.s3;
    if (!s3) {
      this.etatPublication = 'non configuré';
      this.notifier();
      return false;
    }
    if (!navigator.onLine) {
      this.etatPublication = 'hors ligne';
      this.notifier();
      return false;
    }
    const erreurs = verifierIntegrite(this.data);
    if (erreurs.length) {
      this.etatPublication = 'erreur';
      this.notifier();
      signalerErreurs('Publication bloquée : données incohérentes', erreurs);
      return false;
    }
    const version = this.data.modifie;
    this.etatPublication = 'publication…';
    this.notifier();
    try {
      if (!window.isSecureContext || !globalThis.crypto?.subtle)
        throw new Error(
          `Cette page est ouverte en ${location.protocol.replace(':', '')} : la publication exige une adresse https, ` +
            `par exemple https://${s3.bucket}.s3.${s3.region}.amazonaws.com/index.html`,
        );
      const aws = new AwsClient({ accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey, region: s3.region, service: 's3' });
      const url = `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${s3.cle.split('/').map(encodeURIComponent).join('/')}`;
      const r = await aws.fetch(url, {
        method: 'PUT',
        body: JSON.stringify(this.data),
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' },
      });
      if (!r.ok) throw new Error(messageS3(r.status, await r.text()));
      this.config.versionPubliee = version;
      this.config.dernierePublication = new Date().toISOString();
      ecrireJSON(CLE_CONFIG, this.config);
      this.etatPublication = 'à jour';
      this.erreurPublication = undefined;
      this.majEtat();
      this.notifier();
      return true;
    } catch (e) {
      console.error('Publication échouée', e);
      const m = e instanceof Error ? e.message : String(e);
      this.erreurPublication = /Failed to fetch|NetworkError|Load failed/i.test(m)
        ? `Requête bloquée par le navigateur (${m}) : réseau coupé, CORS absent sur le bucket, ou nom de bucket contenant des points`
        : m;
      this.etatPublication = 'erreur';
      this.notifier();
      return false;
    }
  }

  arreter(): void {
    if (this.minuterie) clearInterval(this.minuterie);
  }
}

export const store = new Store();

// Republier automatiquement au retour du réseau
window.addEventListener('online', () => {
  if (store.saisie && store.config.autoPublier && store.etatPublication !== 'à jour') void store.publier();
});
window.addEventListener('offline', () => {
  if (store.saisie && store.etatPublication !== 'à jour') store.etatPublication = 'hors ligne';
});

/** Mémorisation de calculs coûteux, invalidée à chaque changement de données. */
const cache = new Map<string, { rev: number; val: unknown }>();
export function memo<T>(cle: string, f: () => T): T {
  const c = cache.get(cle);
  if (c && c.rev === store.revision) return c.val as T;
  const val = f();
  cache.set(cle, { rev: store.revision, val });
  return val;
}
