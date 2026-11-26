// Modèle de données de Bock (équivalent des tables Access tbl_*)

export type TypeMatch = 'Saison' | 'Séries' | 'Consolation' | 'Finale';
export const TYPES_MATCH: TypeMatch[] = ['Saison', 'Séries', 'Consolation', 'Finale'];

export interface Joueur {
  id: number;
  nom: string;
  nomCourt: string;
  homme: boolean;
  remarque?: string | null;
}

export interface Tournoi {
  id: number;
  /** AAAA-MM-JJ */
  date: string;
  lieu: string;
  nbJoueursSeries: number;
  /** 'elimination' (normal) ou 'ronde' (séries à la ronde, tournoi 1 seulement) */
  typeSeries: 'elimination' | 'ronde';
  /** Si vrai, le différentiel (PP - PC) départage avant les points pour */
  deltaAvantPP: boolean;
  /** Nombre de points pour gagner un match, par type (3 = 3 de 5, 4 = 4 de 7) */
  pointsGagnants: Record<TypeMatch, number>;
  remarque?: string | null;
  /**
   * Champions inscrits à la main, qui remplacent le calcul (cas historiques
   * importés d'Access). null = aucun champion.
   */
  championsInscrits?: { saison?: number | null; series?: number | null; consolation?: number | null };
}

export interface Participation {
  tournoi: number;
  joueur: number;
  /** Rang imposé manuellement, par type de classement */
  rangForce?: Partial<Record<'Saison' | 'Séries' | 'Consolation', number>>;
  remarque?: string | null;
}

export interface Match {
  tournoi: number;
  type: TypeMatch;
  gagnant: number;
  perdant: number;
  scoreG: number;
  scoreP: number;
  supplementaire: boolean;
  blanchissage: boolean;
  /** AAAA-MM-JJTHH:MM:SS */
  dateHeure?: string | null;
  /** Séries/consolation à élimination : position dans le tableau */
  ronde?: number;
  idMatch?: number;
  remarque?: string | null;
}

export interface BockData {
  version: number;
  /** Horodatage de la dernière modification (ISO) */
  modifie?: string;
  joueurs: Joueur[];
  tournois: Tournoi[];
  participations: Participation[];
  matchs: Match[];
}
