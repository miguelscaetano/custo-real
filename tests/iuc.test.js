const { estimateIuc } = require('../src/core/iuc.js');
const tables = require('../src/core/iuc-tables-2026.js');

function car(fields) {
  return {
    price: null,
    firstRegistration: null,
    fuel: 'gasoline',
    combustionFuel: 'gasoline',
    engineCc: null,
    powerHp: null,
    co2: null,
    consumption: null,
    km: null,
    imported: false,
    ...fields,
  };
}

const diesel = { fuel: 'diesel', combustionFuel: 'diesel' };
const reg = (year, month = 1) => ({ year, month });

describe('categoria A (1981 a junho de 2007)', () => {
  test.each([
    ['Honda Prelude 2.2 de 1998', { engineCc: 2157, firstRegistration: reg(1998, 8) }, 158.31],
    ['gasolina 1400 de 2003', { engineCc: 1400, firstRegistration: reg(2003) }, 62.4],
    ['gasolina 998 de 1992', { engineCc: 998, firstRegistration: reg(1992) }, 12.55],
    ['gasolina 1300 de 1987', { engineCc: 1300, firstRegistration: reg(1987) }, 12.55],
    ['gasolina 3600 de 2001', { engineCc: 3600, firstRegistration: reg(2001) }, 512.23],
    ['gasolina 3000 de 1994', { engineCc: 3000, firstRegistration: reg(1994) }, 156.54],
    ['gasóleo 1900 de 1998', { ...diesel, engineCc: 1900, firstRegistration: reg(1998) }, 46.26],
    ['gasóleo 2001 de 2005', { ...diesel, engineCc: 2001, firstRegistration: reg(2005) }, 72.26],
    ['gasóleo 3200 de 2000', { ...diesel, engineCc: 3200, firstRegistration: reg(2000) }, 183.32],
    ['gasóleo 1400 de 1985', { ...diesel, engineCc: 1400, firstRegistration: reg(1985) }, 10.19],
    ['gasóleo 2500 de 1993', { ...diesel, engineCc: 2500, firstRegistration: reg(1993) }, 40.38],
    ['GPL 1600 de 2000', { fuel: 'lpg', combustionFuel: 'lpg', engineCc: 1600, firstRegistration: reg(2000) }, 39.95],
    ['híbrido a gasolina 1497 de 2005', { fuel: 'hybrid', engineCc: 1497, firstRegistration: reg(2005) }, 62.4],
  ])('%s', (_name, fields, expected) => {
    const iuc = estimateIuc(car(fields));
    expect(iuc.status).toBe('ok');
    expect(iuc.category).toBe('A');
    expect(iuc.amount).toBe(expected);
  });

  test.each([
    [1000, 19.9],
    [1001, 39.95],
    [1300, 39.95],
    [1301, 62.4],
    [1750, 62.4],
    [1751, 158.31],
    [2600, 158.31],
    [2601, 287.49],
    [3500, 287.49],
    [3501, 512.23],
  ])('limites dos escalões a gasolina: %s cm3', (engineCc, expected) => {
    expect(estimateIuc(car({ engineCc, firstRegistration: reg(2000) })).amount).toBe(expected);
  });

  test.each([
    [1995, 83.49],
    [1996, 158.31],
    [1989, 36.09],
    [1990, 83.49],
    [1981, 36.09],
  ])('faixas de anos: 2000 cm3 a gasolina de %s', (year, expected) => {
    expect(estimateIuc(car({ engineCc: 2000, firstRegistration: reg(year) })).amount).toBe(expected);
  });

  test('junho de 2007 ainda é categoria A', () => {
    const iuc = estimateIuc(car({ engineCc: 1598, co2: 150, firstRegistration: reg(2007, 6) }));
    expect(iuc.category).toBe('A');
    expect(iuc.amount).toBe(62.4);
  });

  test('valor abaixo de 10 € não é cobrado', () => {
    const iuc = estimateIuc(car({ engineCc: 900, firstRegistration: reg(1985) }));
    expect(iuc.status).toBe('exempt');
    expect(iuc.reason).toBe('below_minimum');
    expect(iuc.amount).toBe(0);
  });

  test('matrícula anterior a 1981 não paga', () => {
    const iuc = estimateIuc(car({ engineCc: 1200, firstRegistration: reg(1978) }));
    expect(iuc.status).toBe('exempt');
    expect(iuc.reason).toBe('pre1981');
  });

  test('sem cilindrada não há valor', () => {
    const iuc = estimateIuc(car({ firstRegistration: reg(1999) }));
    expect(iuc.status).toBe('missing');
    expect(iuc.missing).toEqual(['engineCc']);
    expect(iuc.amount).toBeNull();
  });

  test('com 30 anos ou mais avisa da possível isenção de interesse histórico', () => {
    expect(estimateIuc(car({ engineCc: 1600, firstRegistration: reg(1995) })).notes).toContain(
      'historic_exemption_possible',
    );
    expect(estimateIuc(car({ engineCc: 1600, firstRegistration: reg(1998) })).notes).toEqual([]);
  });

  test('não precisa de CO2', () => {
    expect(estimateIuc(car({ engineCc: 1600, co2: null, firstRegistration: reg(2004) })).status).toBe('ok');
  });
});

describe('categoria B (desde julho de 2007)', () => {
  test.each([
    ['gasolina 898 de 2016 com 86 g (exemplo DECO)', { engineCc: 898, co2: 86, firstRegistration: reg(2016) }, 111.46],
    ['gasóleo 1461 de 2015 com 119 g (exemplo DECO)', { ...diesel, engineCc: 1461, co2: 119, firstRegistration: reg(2015) }, 158.29],
    ['gasolina 1395 de 2019 com 109 g', { engineCc: 1395, co2: 109, firstRegistration: reg(2019) }, 148.22],
    ['BMW 520d de 2026 com 136 g', { ...diesel, engineCc: 1995, co2: 136, firstRegistration: reg(2026, 1) }, 241.5],
    ['gasolina 1598 de julho de 2007 com 150 g', { engineCc: 1598, co2: 150, firstRegistration: reg(2007, 7) }, 161.37],
    ['gasolina 1598 de 2008 com 150 g', { engineCc: 1598, co2: 150, firstRegistration: reg(2008) }, 169.44],
    ['gasolina 1598 de 2009 com 150 g', { engineCc: 1598, co2: 150, firstRegistration: reg(2009) }, 177.51],
    ['gasolina 1598 de 2010 com 150 g', { engineCc: 1598, co2: 150, firstRegistration: reg(2010) }, 185.58],
    ['gasolina 2998 de 2016 com 200 g, sem adicional de CO2', { engineCc: 2998, co2: 200, firstRegistration: reg(2016) }, 745.06],
    ['gasolina 2998 de 2017 com 200 g, com adicional de CO2', { engineCc: 2998, co2: 200, firstRegistration: reg(2017) }, 781.6],
    ['gasóleo 3000 de 2021 com 270 g', { ...diesel, engineCc: 3000, co2: 270, firstRegistration: reg(2021) }, 1061.1],
    ['gasolina 1200 de 2015 com 130 g (NEDC)', { engineCc: 1200, co2: 130, firstRegistration: reg(2015) }, 148.81],
    ['gasolina 1200 de 2022 com 130 g (WLTP)', { engineCc: 1200, co2: 130, firstRegistration: reg(2022) }, 111.46],
    ['híbrido a gasóleo 1950 de 2022 com 35 g', { fuel: 'hybrid', combustionFuel: 'diesel', engineCc: 1950, co2: 35, firstRegistration: reg(2022) }, 241.5],
    ['híbrido plug-in a gasolina 1998 de 2023 com 30 g', { fuel: 'plugin_hybrid', engineCc: 1998, co2: 30, firstRegistration: reg(2023) }, 221.38],
    ['GPL 999 de 2025 com 120 g', { fuel: 'lpg', combustionFuel: 'lpg', engineCc: 999, co2: 120, firstRegistration: reg(2025) }, 111.46],
  ])('%s', (_name, fields, expected) => {
    const iuc = estimateIuc(car(fields));
    expect(iuc.status).toBe('ok');
    expect(iuc.category).toBe('B');
    expect(iuc.amount).toBe(expected);
  });

  test.each([
    [1250, 111.46],
    [1251, 148.22],
    [1750, 148.22],
    [1751, 221.38],
    [2500, 221.38],
    [2501, 576.14],
  ])('limites dos escalões de cilindrada: %s cm3', (engineCc, expected) => {
    expect(estimateIuc(car({ engineCc, co2: 100, firstRegistration: reg(2015) })).amount).toBe(expected);
  });

  test.each([
    [2015, 120, 111.46],
    [2015, 121, 148.81],
    [2015, 180, 148.81],
    [2015, 181, 280.38],
    [2015, 250, 280.38],
    [2015, 251, 454.27],
    [2022, 140, 111.46],
    [2022, 141, 148.81],
    [2022, 205, 148.81],
    [2022, 206, 316.92],
    [2022, 260, 316.92],
    [2022, 261, 527.57],
  ])('limites dos escalões de CO2 em %s: %s g/km', (year, co2, expected) => {
    expect(estimateIuc(car({ engineCc: 1200, co2, firstRegistration: reg(year) })).amount).toBe(expected);
  });

  test('guarda o detalhe do cálculo', () => {
    const iuc = estimateIuc(car({ ...diesel, engineCc: 1995, co2: 136, firstRegistration: reg(2026) }));
    expect(iuc.breakdown).toEqual({
      engineRate: 127.35,
      co2Rate: 65.15,
      co2Extra: 0,
      coefficient: 1.15,
      dieselSurcharge: 20.12,
      co2Standard: 'wltp',
    });
  });

  test('sem CO2 não inventa um valor: devolve o intervalo possível', () => {
    const rav4 = estimateIuc(car({ fuel: 'hybrid', engineCc: 2487, firstRegistration: reg(2025, 7) }));
    expect(rav4.status).toBe('missing');
    expect(rav4.missing).toEqual(['co2']);
    expect(rav4.amount).toBeNull();
    expect(rav4.min).toBe(221.38);
    expect(rav4.max).toBe(637.49);

    const duster = estimateIuc(car({ fuel: 'lpg', combustionFuel: 'lpg', engineCc: 999, firstRegistration: reg(2025, 5) }));
    expect(duster.min).toBe(111.46);
    expect(duster.max).toBe(527.57);
  });

  test('sem CO2 num carro anterior a 2017 o máximo não leva o adicional de CO2', () => {
    const iuc = estimateIuc(car({ engineCc: 1598, firstRegistration: reg(2012) }));
    expect(iuc.min).toBe(148.22);
    expect(iuc.max).toBe(491.04);
  });

  test('sem cilindrada nem CO2 diz o que falta', () => {
    const iuc = estimateIuc(car({ firstRegistration: reg(2018) }));
    expect(iuc.status).toBe('missing');
    expect(iuc.missing).toEqual(['engineCc', 'co2']);
    expect(iuc.min).toBeNull();
  });

  test('em 2018 e 2019 o CO2 pode ser NEDC ou WLTP: mostra o intervalo se fizer diferença', () => {
    const uncertain = estimateIuc(car({ engineCc: 1200, co2: 130, firstRegistration: reg(2019) }));
    expect(uncertain.status).toBe('range');
    expect(uncertain.min).toBe(111.46);
    expect(uncertain.max).toBe(148.81);
    expect(uncertain.notes).toContain('co2_standard_uncertain');

    const same = estimateIuc(car({ engineCc: 1200, co2: 100, firstRegistration: reg(2018) }));
    expect(same.status).toBe('ok');
    expect(same.amount).toBe(111.46);
  });
});

describe('casos especiais', () => {
  test('elétrico está isento', () => {
    const iuc = estimateIuc(car({ fuel: 'electric', combustionFuel: null, firstRegistration: reg(2024, 2), imported: true }));
    expect(iuc.status).toBe('exempt');
    expect(iuc.reason).toBe('electric');
    expect(iuc.amount).toBe(0);
  });

  test('elétrico está isento mesmo sem data de matrícula', () => {
    expect(estimateIuc(car({ fuel: 'electric', combustionFuel: null })).status).toBe('exempt');
  });

  test('2007 sem mês pode ser categoria A ou B', () => {
    const iuc = estimateIuc(car({ engineCc: 1598, co2: 150, firstRegistration: { year: 2007, month: null } }));
    expect(iuc.status).toBe('range');
    expect(iuc.min).toBe(62.4);
    expect(iuc.max).toBe(161.37);
    expect(iuc.notes).toContain('category_uncertain_2007');
  });

  test('2007 sem mês e sem CO2 pede o CO2', () => {
    const iuc = estimateIuc(car({ engineCc: 1598, firstRegistration: { year: 2007, month: null } }));
    expect(iuc.status).toBe('missing');
    expect(iuc.missing).toEqual(['co2']);
    expect(iuc.notes).toContain('category_uncertain_2007');
  });

  test('carro importado leva o aviso', () => {
    const iuc = estimateIuc(car({ engineCc: 1598, co2: 110, firstRegistration: reg(2016), imported: true }));
    expect(iuc.status).toBe('ok');
    expect(iuc.notes).toEqual(['imported']);
  });

  test('sem combustível ou sem data diz o que falta', () => {
    expect(estimateIuc(car({ fuel: null, combustionFuel: null, engineCc: 1598 })).missing).toEqual(['fuel']);
    expect(estimateIuc(car({ engineCc: 1598, co2: 110 })).missing).toEqual(['firstRegistration']);
  });

  test('hidrogénio e combustíveis desconhecidos não são suportados', () => {
    const base = { combustionFuel: null, engineCc: 1598, co2: 110, firstRegistration: reg(2020) };
    expect(estimateIuc(car({ ...base, fuel: 'hydrogen' })).status).toBe('unsupported');
    expect(estimateIuc(car({ ...base, fuel: 'other' })).status).toBe('unsupported');
  });

  test('aceita outras tabelas, para quando os valores forem atualizados', () => {
    const nextYear = {
      ...tables,
      categoryB: { ...tables.categoryB, defaultCoefficient: 1.2 },
    };
    const iuc = estimateIuc(car({ engineCc: 898, co2: 86, firstRegistration: reg(2016) }), nextYear);
    expect(iuc.amount).toBe(116.3);
  });
});

describe('veículos comerciais com IUC no anúncio', () => {
  const van = { firstRegistration: { year: 2024, month: 12 }, fuel: 'diesel', engineCc: 1499, co2: 164, commercial: true };

  test('usa o valor do anúncio em vez de o calcular', () => {
    expect(estimateIuc({ ...van, adIuc: 45.13 })).toMatchObject({ status: 'declared', amount: 45.13 });
  });

  test('o valor do anúncio só é usado nos comerciais', () => {
    const car = estimateIuc({ ...van, commercial: false, adIuc: 45.13 });
    expect(car.status === 'declared').toBe(false);
  });
});

describe('veículos comerciais', () => {
  test('não estima o IUC, mesmo com todos os dados', () => {
    const result = estimateIuc({
      firstRegistration: { year: 2024, month: 12 },
      fuel: 'diesel',
      combustionFuel: 'diesel',
      engineCc: 1499,
      co2: 164,
      imported: false,
      commercial: true,
    });
    expect(result).toMatchObject({ status: 'unsupported', reason: 'commercial', amount: null });
  });
});
