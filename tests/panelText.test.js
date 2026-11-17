const { buildView } = require('../src/ui/panelText.js');
const { estimateIuc } = require('../src/core/iuc.js');
const { estimateFuelCost } = require('../src/core/fuelCost.js');
const { DEFAULT_OPTIONS } = require('../src/core/defaults.js');

function viewFor(fields, extra = {}) {
  const car = {
    firstRegistration: { year: 2016, month: 5 },
    fuel: 'gasoline',
    combustionFuel: 'gasoline',
    engineCc: 1598,
    co2: 110,
    consumption: null,
    imported: false,
    ...fields,
  };
  return buildView({ iuc: estimateIuc(car), fuel: estimateFuelCost(car, DEFAULT_OPTIONS), ...extra });
}

describe('textos do painel', () => {
  test('os valores levam sempre o sinal de aproximado', () => {
    const view = viewFor({});
    expect(view.iuc.headline).toContain('≈');
    expect(view.iuc.headline).toContain('148,22');
    expect(view.iuc.headline).toContain('/ano');
    expect(view.fuel.headline).toContain('≈');
    expect(view.fuel.headline).toContain('127');
    expect(view.fuel.headline).toContain('/mês');
    expect(view.footer).toContain('Estimativa');
  });

  test('categoria B explica as parcelas', () => {
    const view = viewFor({ fuel: 'diesel', combustionFuel: 'diesel', engineCc: 1995, co2: 136, firstRegistration: { year: 2026, month: 1 } });
    expect(view.iuc.headline).toContain('241,50');
    expect(view.iuc.detail).toContain('Categoria B');
    expect(view.iuc.detail).toContain('127,35');
    expect(view.iuc.detail).toContain('65,15');
    expect(view.iuc.detail).toContain('1,15');
    expect(view.iuc.detail).toContain('20,12');
  });

  test('categoria A a gasóleo mostra o adicional', () => {
    const view = viewFor({ fuel: 'diesel', combustionFuel: 'diesel', engineCc: 1900, firstRegistration: { year: 1998, month: 3 } });
    expect(view.iuc.headline).toContain('46,26');
    expect(view.iuc.detail).toContain('Categoria A');
    expect(view.iuc.detail).toContain('6,31');
  });

  test('sem CO2 pede-o ao utilizador e mostra o intervalo', () => {
    const view = viewFor({ co2: null });
    expect(view.iuc.headline).toBe('Falta o CO₂');
    expect(view.iuc.detail).toContain('Falta o CO₂ para calcular o IUC');
    expect(view.iuc.detail).toContain('148,22');
    expect(view.iuc.askCo2).toBe(true);
  });

  test('com CO2 escrito pelo utilizador avisa nas notas', () => {
    const view = viewFor({ co2: 140 }, { co2IsManual: true });
    expect(view.iuc.askCo2).toBe(false);
    expect(view.notes.join(' ')).toContain('CO₂ que indicou');
  });

  test('sem cilindrada nem CO2 diz o que falta e não pede o CO2', () => {
    const view = viewFor({ engineCc: null, co2: null });
    expect(view.iuc.headline).toBe('Faltam dados');
    expect(view.iuc.detail).toContain('Faltam a cilindrada e o CO₂');
    expect(view.iuc.askCo2).toBe(false);
  });

  test('elétrico aparece como isento e com custo em kWh', () => {
    const view = viewFor({ fuel: 'electric', combustionFuel: null, engineCc: null, co2: null, consumption: { value: 18.5, unit: 'kWh/100km' } });
    expect(view.iuc.headline).toBe('Isento');
    expect(view.fuel.detail).toContain('kWh/100 km');
    expect(view.fuel.detail).toContain('do anúncio');
    expect(view.fuel.detail).toContain('€/kWh');
    expect(view.summary).toContain('IUC isento');
  });

  test('importado, intervalo e GPL geram notas', () => {
    expect(viewFor({ imported: true }).notes.join(' ')).toContain('importado');
    const uncertain = viewFor({ engineCc: 1200, co2: 130, firstRegistration: { year: 2019, month: 4 } });
    expect(uncertain.iuc.headline).toContain('111,46');
    expect(uncertain.iuc.headline).toContain('148,81');
    expect(uncertain.notes.join(' ')).toContain('NEDC');
    expect(viewFor({ fuel: 'lpg', combustionFuel: 'lpg' }).notes.join(' ')).toContain('GPL');
  });

  test('híbrido plug-in explica porque não é estimado', () => {
    const view = viewFor({ fuel: 'plugin_hybrid' });
    expect(view.fuel.headline).toBe('Depende do uso');
    expect(view.fuel.detail).toContain('plug-in');
    expect(view.fuel.detail.includes('versão')).toBe(false);
    expect(view.iuc.headline).toContain('148,22');
  });

  test('sem notas a lista fica vazia', () => {
    expect(viewFor({}).notes).toEqual([]);
  });
});

describe('preços automáticos da dgeg', () => {
  const auto = { energies: ['gasoline'], scope: 'district', district: 'Viseu', fetchedAt: Date.UTC(2026, 10, 17, 12) };

  test('indica a origem do preço no detalhe e numa nota', () => {
    const view = viewFor({}, { auto });
    expect(view.fuel.detail).toContain('(DGEG)');
    const note = view.notes.find((text) => text.includes('DGEG'));
    expect(note).toContain('postos de Viseu');
    expect(note).toContain('17/11/2026');
    expect(note).toContain('sem descontos');
  });

  test('sem distrito diz que é a média do continente', () => {
    const view = viewFor({}, { auto: { ...auto, scope: 'national', district: '' } });
    expect(view.notes.find((text) => text.includes('DGEG'))).toContain('do continente');
  });

  test('não mexe no texto quando o combustível do carro não veio da dgeg', () => {
    const view = viewFor({ fuel: 'diesel', combustionFuel: 'diesel', co2: 110 }, { auto });
    expect(view.fuel.detail.includes('(DGEG)')).toBe(false);
    expect(view.notes.some((text) => text.includes('DGEG'))).toBe(false);
  });

  test('sem preços automáticos o texto é o de sempre', () => {
    expect(viewFor({}).fuel.detail.includes('DGEG')).toBe(false);
  });
});

describe('veículos comerciais com IUC no anúncio', () => {
  test('mostra o valor do anúncio e diz de onde vem', () => {
    const view = viewFor({ fuel: 'diesel', combustionFuel: 'diesel', engineCc: 1499, co2: 164, commercial: true, adIuc: 45.13 }, { commercial: true });
    expect(view.iuc.headline).toContain('45,13');
    expect(view.iuc.detail).toContain('indicado no anúncio');
    expect(view.summary).toContain('IUC ≈ 45');
  });
});

describe('veículos comerciais', () => {
  const van = { fuel: 'diesel', combustionFuel: 'diesel', engineCc: 1499, co2: 164, commercial: true };

  test('o IUC não é estimado e remete para o Portal das Finanças', () => {
    const view = viewFor(van, { commercial: true });
    expect(view.iuc.headline).toBe('Não estimado');
    expect(view.iuc.detail).toContain('peso bruto');
    expect(view.iuc.detail).toContain('Portal das Finanças');
  });

  test('o combustível continua a ser estimado e avisa do consumo por defeito', () => {
    const view = viewFor(van, { commercial: true });
    expect(view.fuel.headline).toContain('≈');
    expect(view.notes.some((text) => text.includes('carro ligeiro'))).toBe(true);
  });

  test('num carro normal não aparece o aviso', () => {
    expect(viewFor({}).notes.some((text) => text.includes('carro ligeiro'))).toBe(false);
  });
});
