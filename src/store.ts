// Données et publication
//  - PC de saisie (« mode saisie ») : les données vivent dans le navigateur (localStorage)
//    et sont publiées dans le bucket S3 (bock.json).
//  - Téléphones (lecture seule) : relisent bock.json périodiquement.

import { AwsClient } from 'aws4fetch';
import type { BockData } from './model';

const CLE_DONNEES = 'bock.donnees';
const CLE_CONFIG = 'bock.config';
const URL_DONNEES = 'bock.json';
const INTERVALLE_LECTURE_MS = 30_000;

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

class Store {
  data: BockData = { version: 1, joueurs: [], tournois: [], participations: [], matchs: [] };
  config: Config = lireJSON<Config>(CLE_CONFIG) ?? { saisie: false, autoPublier: true };
  /** Incrémenté à chaque changement (sert d'invalidation des caches) */
  revision = 0;
  etatPublication: EtatPublication = 'à jour';
  derniereLecture?: string;
  erreurLecture?: string;
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
      if (local) this.data = local;
      else await this.chargerServeur();
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
      const r = await fetch(`${URL_DONNEES}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as BockData;
      this.derniereLecture = new Date().toISOString();
      this.erreurLecture = undefined;
      if (d.modifie !== this.data.modifie || !this.data.tournois.length) {
        this.data = d;
        if (this.saisie) ecrireJSON(CLE_DONNEES, d);
        this.notifier();
      } else if (!silencieux) {
        this.notifier();
      }
      return true;
    } catch (e) {
      this.erreurLecture = String(e);
      if (!silencieux) this.notifier();
      return false;
    }
  }

  /** Modifie les données (mode saisie seulement), sauvegarde et publie au besoin. */
  modifier(f: (d: BockData) => void): void {
    if (!this.saisie) throw new Error('Lecture seule');
    f(this.data);
    this.data.modifie = new Date().toISOString();
    ecrireJSON(CLE_DONNEES, this.data);
    this.majEtat();
    this.notifier();
    if (this.config.autoPublier) void this.publier();
  }

  remplacer(d: BockData): void {
    this.data = d;
    this.data.modifie = new Date().toISOString();
    ecrireJSON(CLE_DONNEES, this.data);
    this.majEtat();
    this.notifier();
  }

  sauverConfig(c: Partial<Config>): void {
    this.config = { ...this.config, ...c };
    ecrireJSON(CLE_CONFIG, this.config);
    this.majEtat();
    this.notifier();
  }

  activerSaisie(oui: boolean): void {
    this.sauverConfig({ saisie: oui });
    if (oui) ecrireJSON(CLE_DONNEES, this.data);
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
    const version = this.data.modifie;
    this.etatPublication = 'publication…';
    this.notifier();
    try {
      const aws = new AwsClient({ accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey, region: s3.region, service: 's3' });
      const url = `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${s3.cle.split('/').map(encodeURIComponent).join('/')}`;
      const r = await aws.fetch(url, {
        method: 'PUT',
        body: JSON.stringify(this.data),
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      this.config.versionPubliee = version;
      this.config.dernierePublication = new Date().toISOString();
      ecrireJSON(CLE_CONFIG, this.config);
      this.etatPublication = 'à jour';
      this.majEtat();
      this.notifier();
      return true;
    } catch (e) {
      console.error('Publication échouée', e);
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
