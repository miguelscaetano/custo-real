const { resolveOptions, sanitizePriceSettings } = require('../src/core/prices.js');
const { DEFAULT_OPTIONS } = require('../src/core/defaults.js');

const autoPrices = { gasoline: 1.9, diesel: 1.7, lpg: null, scope: 'district', district: 'Viseu', fetchedAt: 10 };

describe('resolveOptions', () => {
  test('em modo automático os preços da dgeg substituem os das opções', () => {
    const { options, auto } = resolveOptions({ options: DEFAULT_OPTIONS, priceMode: 'auto', autoPrices });
    expect(options.gasolinePrice).toBe(1.9);
    expect(options.dieselPrice).toBe(1.7);
    expect(auto).toEqual({ energies: ['gasoline', 'diesel'], scope: 'district', district: 'Viseu', fetchedAt: 10 });
  });

  test('um combustível sem preço automático mantém o valor das opções', () => {
    const { options } = resolveOptions({ options: DEFAULT_OPTIONS, priceMode: 'auto', autoPrices });
    expect(options.lpgPrice).toBe(DEFAULT_OPTIONS.lpgPrice);
  });

  test('o preço da eletricidade nunca é automático', () => {
    const { options } = resolveOptions({ options: { ...DEFAULT_OPTIONS, kwhPrice: 0.31 }, priceMode: 'auto', autoPrices });
    expect(options.kwhPrice).toBe(0.31);
  });

  test('em modo manual ignora os preços guardados', () => {
    const { options, auto } = resolveOptions({ options: DEFAULT_OPTIONS, priceMode: 'manual', autoPrices });
    expect(options).toEqual(DEFAULT_OPTIONS);
    expect(auto).toBeNull();
  });

  test('sem preços guardados usa as opções', () => {
    expect(resolveOptions({ options: DEFAULT_OPTIONS, priceMode: 'auto', autoPrices: null }).auto).toBeNull();
  });

  test('preços inválidos guardados não passam', () => {
    const bad = { gasoline: 0, diesel: NaN, lpg: -1, scope: 'national', district: '', fetchedAt: 1 };
    const { options, auto } = resolveOptions({ options: DEFAULT_OPTIONS, priceMode: 'auto', autoPrices: bad });
    expect(options).toEqual(DEFAULT_OPTIONS);
    expect(auto).toBeNull();
  });

  test('não altera o objeto de opções recebido', () => {
    const original = { ...DEFAULT_OPTIONS };
    resolveOptions({ options: original, priceMode: 'auto', autoPrices });
    expect(original).toEqual(DEFAULT_OPTIONS);
  });
});

describe('sanitizePriceSettings', () => {
  test('por defeito é automático e sem distrito', () => {
    expect(sanitizePriceSettings({})).toEqual({ priceMode: 'auto', district: '' });
    expect(sanitizePriceSettings(undefined)).toEqual({ priceMode: 'auto', district: '' });
  });

  test('só aceita manual ou automático', () => {
    expect(sanitizePriceSettings({ priceMode: 'manual', district: 'Viseu' })).toEqual({ priceMode: 'manual', district: 'Viseu' });
    expect(sanitizePriceSettings({ priceMode: 'xpto', district: 3 })).toEqual({ priceMode: 'auto', district: '' });
  });
});
