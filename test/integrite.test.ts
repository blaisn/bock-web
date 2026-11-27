import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BockData } from '../src/model';
import { blocageMatch, verifierIntegrite } from '../src/engine/integrite';

const original: BockData = JSON.parse(readFileSync(new URL('../data-import/bock.json', import.meta.url), 'utf8'));
const copie = (): BockData => structuredClone(original);
const premierSaison = (d: BockData) => d.matchs.find((m) => m.tournoi === 38 && m.type === 'Saison')!;

describe('Intégrité', () => {
  it('les données historiques sont intègres', () => {
    expect(verifierIntegrite(original)).toEqual([]);
  });

  const cas: [string, (d: BockData) => void, RegExp][] = [
    ['clé primaire joueur', (d) => d.joueurs.push({ ...d.joueurs[0] }), /en double/],
    ['clé primaire tournoi', (d) => d.tournois.push({ ...d.tournois[0] }), /en double/],
    ['participation unique', (d) => d.participations.push({ ...d.participations[0] }), /inscrit deux fois/],
    ['participation → joueur', (d) => d.participations.push({ tournoi: 38, joueur: 999 }), /joueur inexistant/],
    ['participation → tournoi', (d) => d.participations.push({ tournoi: 999, joueur: 1 }), /tournoi inexistant/],
    ['match → participation', (d) => (premierSaison(d).gagnant = 26), /n'est pas inscrit/],
    ['match contre soi-même', (d) => (premierSaison(d).perdant = premierSaison(d).gagnant), /lui-même/],
    ['pointage invalide', (d) => (premierSaison(d).scoreG = 5), /pointage/],
    ['perdant avec plus de points', (d) => Object.assign(premierSaison(d), { scoreG: 1, scoreP: 3 }), /pointage/],
    ['blanchissage incohérent', (d) => Object.assign(premierSaison(d), { scoreG: 3, scoreP: 0, blanchissage: false }), /blanchissage/],
    ['un match par paire', (d) => d.matchs.push({ ...premierSaison(d) }), /déjà un match/],
    ['un match par position', (d) => d.matchs.push({ ...d.matchs.find((m) => m.tournoi === 38 && m.type === 'Finale')! }), /même position/],
    ['position manquante', (d) => delete d.matchs.find((m) => m.tournoi === 38 && m.type === 'Séries')!.ronde, /position/],
    ['trop de joueurs en séries', (d) => (d.tournois.find((t) => t.id === 38)!.nbJoueursSeries = 9), /joueurs en séries/],
    ['tournoi supprimé avec ses matchs', (d) => (d.tournois = d.tournois.filter((t) => t.id !== 38)), /tournoi inexistant/],
    ['joueur supprimé avec ses matchs', (d) => (d.joueurs = d.joueurs.filter((j) => j.id !== 1)), /joueur inexistant/],
  ];
  for (const [nom, modif, attendu] of cas) {
    it(`détecte : ${nom}`, () => {
      const d = copie();
      modif(d);
      const e = verifierIntegrite(d);
      expect(e.length).toBeGreaterThan(0);
      expect(e.join('\n')).toMatch(attendu);
    });
  }

  it('format invalide', () => {
    expect(verifierIntegrite({} as BockData)[0]).toMatch(/Format/);
  });
});

describe('Suppression de matchs', () => {
  const d = original;
  const t38 = d.matchs.filter((m) => m.tournoi === 38);
  it('un quart de finale suivi d’une demi jouée est bloqué', () => {
    const quart = t38.find((m) => m.type === 'Séries' && m.ronde === 1)!;
    expect(blocageMatch(d, quart)).toMatch(/suivant/);
  });
  it('la finale et les matchs de saison sont libres', () => {
    expect(blocageMatch(d, t38.find((m) => m.type === 'Finale')!)).toBeUndefined();
    expect(blocageMatch(d, t38.find((m) => m.type === 'Saison')!)).toBeUndefined();
  });
});
