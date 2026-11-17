const { estimateFuelCost } = require('../src/core/fuelCost.js');
const { DEFAULT_OPTIONS, sanitizeOptions } = require('../src/core/defaults.js');

const options = {
  kmPerMonth: 1000,
  gasolinePrice: 1.95,
  dieselPrice: 2.15,
  lpgPrice: 1,
  kwhPrice: 0.2,
  gasolineConsumption: 6.5,
  dieselConsumption: 5.5,
  hybridConsumption: 5,
  lpgConsumption: 8.5,
  electricConsumption: 17,
};

const litres = (value) => ({ value, unit: 'l/100km' });
const kwh = (value) => ({ value, unit: 'kWh/100km' });

function car(fuel, combustionFuel, consumption = null) {
  return { fuel, combustionFuel, consumption };
}

describe('estimateFuelCost', () => {
  test('gasolina sem consumo no anúncio usa o consumo por defeito', () => {
    const cost = estimateFuelCost(car('gasoline', 'gasoline'), options);
    expect(cost).toMatchObject({
      status: 'ok',
      monthly: 126.75,
      energy: 'gasoline',
      consumption: litres(6.5),
      consumptionSource: 'default',
      unitPrice: 1.95,
      kmPerMonth: 1000,
    });
  });

  test('gasóleo com consumo no anúncio usa o do anúncio', () => {
    const cost = estimateFuelCost(car('diesel', 'diesel', litres(5.4)), options);
    expect(cost.monthly).toBe(116.1);
    expect(cost.consumptionSource).toBe('ad');
  });

  test('elétrico com consumo do anúncio (Mustang Mach-E, 18,5 kWh/100 km)', () => {
    const cost = estimateFuelCost(car('electric', null, kwh(18.5)), options);
    expect(cost.monthly).toBe(37);
    expect(cost.energy).toBe('electric');
    expect(cost.consumptionSource).toBe('ad');
  });

  test('elétrico sem consumo usa o valor por defeito', () => {
    const cost = estimateFuelCost(car('electric', null), options);
    expect(cost.monthly).toBe(34);
    expect(cost.consumption).toEqual(kwh(17));
  });

  test('híbrido a gasolina usa o preço da gasolina e o consumo dos híbridos', () => {
    const cost = estimateFuelCost(car('hybrid', 'gasoline'), options);
    expect(cost.monthly).toBe(97.5);
    expect(cost.energy).toBe('gasoline');
    expect(cost.consumption).toEqual(litres(5));
  });

  test('híbrido com consumo no anúncio', () => {
    expect(estimateFuelCost(car('hybrid', 'gasoline', litres(4.7)), options).monthly).toBe(91.65);
  });

  test('híbrido a gasóleo usa o preço do gasóleo', () => {
    const cost = estimateFuelCost(car('hybrid', 'diesel'), options);
    expect(cost.monthly).toBe(107.5);
    expect(cost.energy).toBe('diesel');
  });

  test('GPL usa sempre o consumo das opções e avisa', () => {
    const cost = estimateFuelCost(car('lpg', 'lpg', litres(6.1)), options);
    expect(cost.monthly).toBe(85);
    expect(cost.consumptionSource).toBe('default');
    expect(cost.notes).toEqual(['lpg_always_on_lpg']);
  });

  test('consumo numa unidade que não bate com o combustível é ignorado', () => {
    const cost = estimateFuelCost(car('gasoline', 'gasoline', kwh(16)), options);
    expect(cost.consumption).toEqual(litres(6.5));
    expect(cost.consumptionSource).toBe('default');
  });

  test('os quilómetros por mês escalam o custo', () => {
    const cost = estimateFuelCost(car('diesel', 'diesel'), { ...options, kmPerMonth: 2500 });
    expect(cost.monthly).toBe(295.63);
    expect(cost.kmPerMonth).toBe(2500);
  });

  test('híbrido plug-in não é estimado nesta versão', () => {
    const cost = estimateFuelCost(car('plugin_hybrid', 'gasoline', litres(1.4)), options);
    expect(cost.status).toBe('unsupported');
    expect(cost.reason).toBe('plugin_hybrid');
    expect(cost.monthly).toBeNull();
  });

  test.each([['cng'], ['hydrogen'], ['other']])('%s não é suportado', (fuel) => {
    const cost = estimateFuelCost(car(fuel, null), options);
    expect(cost.status).toBe('unsupported');
    expect(cost.reason).toBe('fuel');
  });

  test('sem combustível diz o que falta', () => {
    const cost = estimateFuelCost(car(null, null), options);
    expect(cost.status).toBe('missing');
    expect(cost.missing).toEqual(['fuel']);
  });
});

describe('opções', () => {
  test('sem nada guardado ficam os valores por defeito', () => {
    expect(sanitizeOptions({})).toEqual({ ...DEFAULT_OPTIONS });
    expect(sanitizeOptions(undefined)).toEqual({ ...DEFAULT_OPTIONS });
  });

  test('valores inválidos são substituídos pelos valores por defeito', () => {
    const stored = { kmPerMonth: 0, gasolinePrice: -1, dieselPrice: 'abc', kwhPrice: null, lpgPrice: '1.1' };
    const options = sanitizeOptions(stored);
    expect(options.kmPerMonth).toBe(DEFAULT_OPTIONS.kmPerMonth);
    expect(options.gasolinePrice).toBe(DEFAULT_OPTIONS.gasolinePrice);
    expect(options.dieselPrice).toBe(DEFAULT_OPTIONS.dieselPrice);
    expect(options.kwhPrice).toBe(DEFAULT_OPTIONS.kwhPrice);
    expect(options.lpgPrice).toBe(1.1);
  });

  test('chaves desconhecidas são ignoradas', () => {
    expect(sanitizeOptions({ outra: 5 }).outra).toBe(undefined);
  });
});
