const { normalizeCar, parseNumber, parseFuel, parseMonth } = require('../src/core/normalizeCar.js');

describe('parseNumber', () => {
  test.each([
    ['1 598 cm3', 1598],
    ['1.598 cm3', 1598],
    ['1598', 1598],
    ['15 000 km', 15000],
    ['15.000 km', 15000],
    ['86 000 km', 86000],
    ['120 g/km', 120],
    ['5,4 l/100km', 5.4],
    ['18.5 l/100km', 18.5],
    ['19.250,00 €', 19250],
    ['19 250 EUR', 19250],
    ['1.234.567', 1234567],
    ['185 cv', 185],
    [2157, 2157],
  ])('%s -> %s', (text, expected) => {
    expect(parseNumber(text)).toBe(expected);
  });

  test.each([[''], ['sem número'], [null], [undefined], [NaN], [{}]])('%s -> null', (value) => {
    expect(parseNumber(value)).toBeNull();
  });
});

describe('parseFuel', () => {
  test.each([
    ['gaz', 'Gasolina', 'gasoline', 'gasoline'],
    ['diesel', 'Diesel', 'diesel', 'diesel'],
    [null, 'Gasóleo', 'diesel', 'diesel'],
    ['electric', 'Elétrico', 'electric', null],
    [null, 'Eléctrico', 'electric', null],
    ['gpl', 'GPL', 'lpg', 'lpg'],
    ['hibride-gaz', 'Híbrido (Gasolina)', 'hybrid', 'gasoline'],
    ['hibride-diesel', 'Híbrido (Diesel)', 'hybrid', 'diesel'],
    [null, 'Híbrido Plug-In', 'plugin_hybrid', 'gasoline'],
    [null, 'Híbrido Plug-In (Gasóleo)', 'plugin_hybrid', 'diesel'],
    [null, 'GNC', 'cng', 'cng'],
    [null, 'Hidrogénio', 'hydrogen', null],
    [null, 'Outro', 'other', null],
  ])('%s / %s -> %s', (code, label, fuel, combustionFuel) => {
    expect(parseFuel(code, label)).toEqual({ fuel, combustionFuel });
  });

  test('sem código nem texto fica a null', () => {
    expect(parseFuel(null, null)).toEqual({ fuel: null, combustionFuel: null });
    expect(parseFuel(undefined, '')).toEqual({ fuel: null, combustionFuel: null });
  });
});

describe('parseMonth', () => {
  test.each([
    ['8', 8],
    ['08', 8],
    [3, 3],
    ['Agosto', 8],
    ['março', 3],
    ['Maio', 5],
    ['JUNHO', 6],
    ['julho', 7],
    ['dez', 12],
  ])('%s -> %s', (value, expected) => {
    expect(parseMonth(value)).toBe(expected);
  });

  test.each([['13'], ['0'], ['xx'], [''], [null], [undefined]])('%s -> null', (value) => {
    expect(parseMonth(value)).toBeNull();
  });
});

describe('normalizeCar', () => {
  test('carro a gasóleo com todos os dados em texto visível', () => {
    const car = normalizeCar({
      price: '14 990 EUR',
      fuelLabel: 'Diesel',
      registrationYear: '2015',
      registrationMonth: 'Março',
      engineCapacity: '1 598 cm3',
      enginePower: '120 cv',
      co2: '120 g/km',
      consumption: '5,4 l/100km',
      mileage: '15 000 km',
      origin: 'Nacional',
    });
    expect(car).toEqual({
      price: 14990,
      firstRegistration: { year: 2015, month: 3 },
      fuel: 'diesel',
      combustionFuel: 'diesel',
      engineCc: 1598,
      powerHp: 120,
      co2: 120,
      consumption: { value: 5.4, unit: 'l/100km' },
      km: 15000,
      imported: false,
    });
  });

  test('os campos que não existem ficam a null', () => {
    expect(normalizeCar({})).toEqual({
      price: null,
      firstRegistration: null,
      fuel: null,
      combustionFuel: null,
      engineCc: null,
      powerHp: null,
      co2: null,
      consumption: null,
      km: null,
      imported: null,
    });
    expect(normalizeCar(null).fuel).toBeNull();
    expect(normalizeCar(undefined).price).toBeNull();
  });

  test.each([
    ['03/2015', { year: 2015, month: 3 }],
    ['15/03/2015', { year: 2015, month: 3 }],
    ['2015-03-15', { year: 2015, month: 3 }],
    ['2015-11', { year: 2015, month: 11 }],
    ['Março 2015', { year: 2015, month: 3 }],
    ['dezembro de 1999', { year: 1999, month: 12 }],
    ['2015', { year: 2015, month: null }],
    ['sem data', null],
  ])('data de matrícula "%s"', (registrationDate, expected) => {
    expect(normalizeCar({ registrationDate }).firstRegistration).toEqual(expected);
  });

  test('ano sem mês deixa o mês a null', () => {
    expect(normalizeCar({ registrationYear: '2007' }).firstRegistration).toEqual({ year: 2007, month: null });
    expect(normalizeCar({ registrationYear: 2007, registrationMonth: 'Julho' }).firstRegistration).toEqual({
      year: 2007,
      month: 7,
    });
  });

  test('num elétrico o consumo é em kWh mesmo que o anúncio diga litros', () => {
    const car = normalizeCar({ fuelCode: 'electric', consumption: '18.5 l/100km', engineCapacity: '0 cm3', co2: '0 g/km' });
    expect(car.consumption).toEqual({ value: 18.5, unit: 'kWh/100km' });
    expect(car.engineCc).toBeNull();
    expect(car.co2).toBeNull();
  });

  test('consumo em kWh escrito no texto', () => {
    expect(normalizeCar({ fuelLabel: 'Híbrido Plug-In', consumption: '16,2 kWh/100km' }).consumption).toEqual({
      value: 16.2,
      unit: 'kWh/100km',
    });
  });

  test('valores absurdos são ignorados em vez de usados', () => {
    const car = normalizeCar({
      fuelLabel: 'Gasolina',
      engineCapacity: '1.6',
      co2: '0 g/km',
      consumption: '540 l/100km',
      enginePower: '0 cv',
      registrationYear: 'desconhecido',
    });
    expect(car.engineCc).toBeNull();
    expect(car.co2).toBeNull();
    expect(car.consumption).toBeNull();
    expect(car.powerHp).toBeNull();
    expect(car.firstRegistration).toBeNull();
  });

  test.each([
    [{ imported: '1' }, true],
    [{ imported: '0' }, false],
    [{ imported: 'Sim' }, true],
    [{ imported: 'Não' }, false],
    [{ origin: 'imported' }, true],
    [{ origin: 'Importado' }, true],
    [{ origin: 'national' }, false],
    [{}, null],
  ])('importado %o -> %s', (raw, expected) => {
    expect(normalizeCar(raw).imported).toBe(expected);
  });

  test('carro com zero quilómetros', () => {
    expect(normalizeCar({ mileage: '0 km' }).km).toBe(0);
  });
});
