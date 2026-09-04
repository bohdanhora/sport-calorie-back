import { sumNutrition } from './nutrition-totals';

describe('sumNutrition', () => {
  it('adds up energy and macros', () => {
    expect(
      sumNutrition([
        { energyKcal: 330, proteinG: 62, carbsG: 0, fatG: 7.2 },
        { energyKcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
      ]),
    ).toEqual({ energyKcal: 525, proteinG: 66, carbsG: 42, fatG: 7.7 });
  });

  it('still totals calories when macros were never entered', () => {
    expect(sumNutrition([{ energyKcal: 120 }, { energyKcal: 80, proteinG: 5 }])).toEqual({
      energyKcal: 200,
      proteinG: 5,
      carbsG: 0,
      fatG: 0,
    });
  });

  it('returns zeros for an empty day', () => {
    expect(sumNutrition([])).toEqual({ energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});
