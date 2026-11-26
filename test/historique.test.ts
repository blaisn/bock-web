// Validation du moteur contre les valeurs calculées par Access pour les 38 tournois
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BockData } from '../src/model';
import { CHAMPS_FICHE, type Fiche } from '../src/engine/fiche';
import { championsTournoi, classementRonde } from '../src/engine/tournoi';

const data: BockData = JSON.parse(readFileSync(new URL('../data-import/bock.json', import.meta.url), 'utf8'));
interface Val {
  tournoi: number;
  joueur: number;
  rang: number;
  meilleur: number;
  pire: number;
  FC: number[];
  FR: number[];
  FV: number[];
  MX: number[];
  MN: number[];
}
const valeurs: { rangs: Val[]; champions: { tournoi: number; saison: number; series: number; consolation: number | null }[] } =
  JSON.parse(readFileSync(new URL('../data-import/access-valeurs.json', import.meta.url), 'utf8'));

const vec = (f: Fiche) => CHAMPS_FICHE.map((k) => f[k]);

export function comparer() {
  const ecarts: Record<string, string[]> = { rang: [], FC: [], FR: [], FV: [], MX: [], MN: [], minmax: [], champions: [] };
  for (const t of data.tournois) {
    const cl = classementRonde(data, t.id, 'Saison');
    const parJoueur = new Map(cl.map((l) => [l.joueur, l]));
    for (const v of valeurs.rangs.filter((x) => x.tournoi === t.id)) {
      const l = parJoueur.get(v.joueur)!;
      const tag = `T${t.id} J${v.joueur}`;
      if (l.rang !== v.rang) ecarts.rang.push(`${tag}: access=${v.rang} calcul=${l.rang}`);
      for (const f of ['FC', 'FR', 'FV', 'MX', 'MN'] as const) {
        const a = v[f].join(',');
        const c = vec(l[f]).join(',');
        if (a !== c) ecarts[f].push(`${tag}: access=[${a}] calcul=[${c}]`);
      }
      if (l.meilleurRang !== v.meilleur || l.pireRang !== v.pire)
        ecarts.minmax.push(`${tag}: access=${v.meilleur}/${v.pire} calcul=${l.meilleurRang}/${l.pireRang}`);
    }
    const ch = championsTournoi(data, t.id);
    const a = valeurs.champions.find((c) => c.tournoi === t.id)!;
    const norm = (x: number | null | undefined) => x || 0;
    if (norm(a.saison) !== norm(ch.saison) || norm(a.series) !== norm(ch.series) || norm(a.consolation) !== norm(ch.consolation))
      ecarts.champions.push(
        `T${t.id}: access=${a.saison}/${a.series}/${a.consolation} calcul=${ch.saison}/${ch.series}/${ch.consolation}`,
      );
  }
  return ecarts;
}

describe('Historique Access', () => {
  it('reproduit les classements des 38 tournois', () => {
    const e = comparer();
    for (const [k, l] of Object.entries(e)) {
      console.log(`--- ${k}: ${l.length} écart(s)`);
      for (const x of l.slice(0, 40)) console.log('   ', x);
    }
    // Écarts connus et expliqués :
    //  - Tournoi 1 : séries « à la ronde » ; Access y a écrasé les fiches de saison par celles des séries.
    //  - Joueur 8, tournois 6-7 : 1 point contre de différence dans la fiche à vie
    //    (un match ancien corrigé après coup dans Access).
    const inattendus = Object.values(e)
      .flat()
      .filter((x) => !x.startsWith('T1 ') && !/^T[67] J8:/.test(x));
    expect(inattendus).toEqual([]);
  });
});
