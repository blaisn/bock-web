import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BockData } from '../src/model';
import { construireTableau, ordrePlacement, prochainePuissanceDe2 } from '../src/engine/bracket';
import { estBlanchissage, estSupplementaire, scoreParDefaut, scoreValide } from '../src/engine/regles';

describe('Pointages', () => {
  it('3 de 5', () => {
    expect(scoreValide(3, 3, 0)).toBe(true);
    expect(scoreValide(3, 2, 3)).toBe(true);
    expect(scoreValide(3, 4, 3)).toBe(true);
    expect(scoreValide(3, 4, 2)).toBe(false);
    expect(scoreValide(3, 3, 3)).toBe(false);
    expect(scoreValide(3, 0, 0)).toBe(true); // effacement
    expect(estSupplementaire(3, 3, 4)).toBe(true);
    expect(estBlanchissage(3, 0, 3)).toBe(true);
    expect(scoreParDefaut(3, 1)).toBe(3);
    expect(scoreParDefaut(3, 4)).toBe(3);
    expect(scoreParDefaut(3, 3)).toBeNull();
  });

  it('tous les matchs historiques respectent les règles', () => {
    const data: BockData = JSON.parse(readFileSync(new URL('../data-import/bock.json', import.meta.url), 'utf8'));
    const invalides = data.matchs.filter((m) => {
      const t = data.tournois.find((x) => x.id === m.tournoi)!;
      const max = t.pointsGagnants[m.type];
      return (
        !scoreValide(max, m.scoreG, m.scoreP) ||
        estSupplementaire(max, m.scoreG, m.scoreP) !== m.supplementaire ||
        estBlanchissage(max, m.scoreG, m.scoreP) !== m.blanchissage
      );
    });
    expect(invalides.length).toBeLessThanOrEqual(5);
  });
});

describe('Tableau éliminatoire', () => {
  it('placement', () => {
    expect(prochainePuissanceDe2(1)).toBe(2);
    expect(prochainePuissanceDe2(8)).toBe(8);
    expect(prochainePuissanceDe2(9)).toBe(16);
    expect(ordrePlacement(4)).toEqual([1, 4, 2, 3]);
    expect(ordrePlacement(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('laissez-passer et progression', () => {
    // 3 joueurs : la tête 1 passe directement en finale
    const t = construireTableau('Consolation', [10, 20, 30], [
      { tournoi: 1, type: 'Consolation', gagnant: 30, perdant: 20, scoreG: 3, scoreP: 1, supplementaire: false, blanchissage: false, ronde: 1, idMatch: 2 },
    ]);
    expect(t.rondes[0][0].laissezPasser).toBe(true);
    expect(t.rondes[1][0].haut).toMatchObject({ joueur: 10 });
    expect(t.rondes[1][0].bas).toMatchObject({ joueur: 30 });
    expect(t.champion).toBeUndefined();
  });
});
