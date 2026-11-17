const site = require('../src/sites/standvirtual.js');
const { normalizeCar } = require('../src/core/normalizeCar.js');
const { estimateIuc } = require('../src/core/iuc.js');
const { estimateFuelCost } = require('../src/core/fuelCost.js');
const { DEFAULT_OPTIONS } = require('../src/core/defaults.js');
const adverts = require('./fixtures/standvirtualAdverts.js');

const pathOf = (advert) => new URL(advert.url).pathname;

function documentWith(advert) {
  const json = JSON.stringify({ props: { pageProps: { advert } } });
  return { getElementById: (id) => (id === '__NEXT_DATA__' ? { textContent: json } : null) };
}

const emptyDocument = { getElementById: () => null };

describe('IUC indicado no anúncio', () => {
  const withIuc = (value) => ({ parametersDict: { iuc: { values: [{ value }] } } });

  test.each([['45.13', 45.13], ['45,13', 45.13], ['120', 120]])('%s dá %d', (value, expected) => {
    expect(site.readAdIuc(withIuc(value))).toBe(expected);
  });

  test.each([[''], ['0'], ['abc'], ['-5'], ['99999']])('%o é ignorado', (value) => {
    expect(site.readAdIuc(withIuc(value))).toBeNull();
  });

  test('sem o campo devolve null', () => {
    expect(site.readAdIuc({})).toBeNull();
    expect(site.readAdIuc(adverts.bmw520d2026)).toBeNull();
  });
});

describe('secção do anúncio', () => {
  test('só os anúncios de comerciais são marcados como comerciais', () => {
    expect(site.isCommercialPath('/comerciais/anuncio/peugeot-expert-ID8Q0CNN.html')).toBe(true);
    expect(site.isCommercialPath('/carros/anuncio/toyota-rav4-ID8Q0DS9.html')).toBe(false);
    expect(site.isCommercialPath('/comerciais')).toBe(false);
  });
});

describe('reconhecer a página de um anúncio', () => {
  test.each([
    ['/carros/anuncio/honda-prelude-ver-2-2-vti-automatic-ID8PVn7T.html', '8PVn7T'],
    ['/carros/anuncio/toyota-rav4-ID8Q0DS9.html', '8Q0DS9'],
    ['/comerciais/anuncio/peugeot-expert-standard-1-5-bluehdi-120-cv-iva-dedutivel-nacional-ID8Q0CNN.html', '8Q0CNN'],
  ])('%s', (pathname, id) => {
    expect(site.getAdId(pathname)).toBe(id);
    expect(site.isAdPage({ hostname: 'www.standvirtual.com', pathname })).toBe(true);
  });

  test.each([['/'], ['/carros'], ['/carros/honda/prelude'], ['/motos/anuncio/honda-cb-ID8abc.html'], ['/carros/anuncio/']])(
    '%s não é um anúncio de carro',
    (pathname) => {
      expect(site.getAdId(pathname)).toBeNull();
      expect(site.isAdPage({ hostname: 'www.standvirtual.com', pathname })).toBe(false);
    },
  );

  test('noutro domínio não faz nada', () => {
    const pathname = '/carros/anuncio/toyota-rav4-ID8Q0DS9.html';
    expect(site.isAdPage({ hostname: 'www.exemplo.com', pathname })).toBe(false);
  });
});

describe('extrair os dados brutos', () => {
  test('gasóleo com CO2 (BMW 520d)', () => {
    expect(site.extractRawCar(adverts.bmw520d2026)).toEqual({
      source: 'standvirtual',
      id: '8097753508',
      title: 'BMW 520 d Pack Desportivo M',
      price: '57900',
      currency: 'EUR',
      fuelCode: 'diesel',
      fuelLabel: 'Diesel',
      registrationYear: '2026',
      registrationMonth: '1',
      engineCapacity: '1995',
      enginePower: '197',
      co2: '136',
      consumption: null,
      mileage: '17620',
      imported: '0',
      origin: 'national',
    });
  });

  test('elétrico: sem cilindrada e com consumo em texto', () => {
    const raw = site.extractRawCar(adverts.fordMustangMachE2024);
    expect(raw.engineCapacity).toBeNull();
    expect(raw.consumption).toBe('18.5 l/100km');
    expect(raw.imported).toBe('1');
  });

  test('se faltar o parametersDict usa o texto visível', () => {
    const { parametersDict, ...withoutParams } = adverts.hondaPrelude1998;
    const raw = site.extractRawCar(withoutParams);
    expect(raw.engineCapacity).toBe('2 157 cm3');
    expect(raw.registrationMonth).toBe('Agosto');
    expect(normalizeCar(raw).engineCc).toBe(2157);
    expect(normalizeCar(raw).firstRegistration).toEqual({ year: 1998, month: 8 });
    expect(normalizeCar(raw).imported).toBe(false);
  });

  test('anúncio quase vazio não rebenta', () => {
    const raw = site.extractRawCar({ url: 'https://www.standvirtual.com/carros/anuncio/x-ID1.html' });
    expect(raw.price).toBeNull();
    expect(normalizeCar(raw).fuel).toBeNull();
  });
});

describe('anúncios reais, do JSON do site até à estimativa', () => {
  const estimate = (advert) => {
    const car = normalizeCar(site.extractRawCar(advert));
    return { car, iuc: estimateIuc(car), fuel: estimateFuelCost(car, DEFAULT_OPTIONS) };
  };

  test('Honda Prelude 2.2 a gasolina de agosto de 1998', () => {
    const { car, iuc, fuel } = estimate(adverts.hondaPrelude1998);
    expect(car).toEqual({
      price: 19250,
      firstRegistration: { year: 1998, month: 8 },
      fuel: 'gasoline',
      combustionFuel: 'gasoline',
      engineCc: 2157,
      powerHp: 185,
      co2: null,
      consumption: null,
      km: 86000,
      imported: false,
    });
    expect(iuc).toMatchObject({ status: 'ok', category: 'A', amount: 158.31 });
    expect(fuel).toMatchObject({ status: 'ok', monthly: 126.75, consumptionSource: 'default' });
  });

  test('BMW 520d a gasóleo de janeiro de 2026', () => {
    const { car, iuc, fuel } = estimate(adverts.bmw520d2026);
    expect(car).toMatchObject({ fuel: 'diesel', engineCc: 1995, co2: 136, km: 17620, price: 57900 });
    expect(iuc).toMatchObject({ status: 'ok', category: 'B', amount: 241.5 });
    expect(fuel).toMatchObject({ status: 'ok', monthly: 118.25 });
  });

  test('Ford Mustang Mach-E elétrico e importado de 2024', () => {
    const { car, iuc, fuel } = estimate(adverts.fordMustangMachE2024);
    expect(car).toMatchObject({
      fuel: 'electric',
      engineCc: null,
      consumption: { value: 18.5, unit: 'kWh/100km' },
      imported: true,
      firstRegistration: { year: 2024, month: 2 },
    });
    expect(iuc).toMatchObject({ status: 'exempt', reason: 'electric' });
    expect(fuel).toMatchObject({ status: 'ok', monthly: 37, consumptionSource: 'ad' });
  });

  test('Toyota RAV4 híbrido de 2025 sem CO2 no anúncio', () => {
    const { car, iuc, fuel } = estimate(adverts.toyotaRav4Hybrid2025);
    expect(car).toMatchObject({ fuel: 'hybrid', combustionFuel: 'gasoline', engineCc: 2487, co2: null });
    expect(iuc).toMatchObject({ status: 'missing', missing: ['co2'], min: 221.38, max: 637.49 });
    expect(fuel).toMatchObject({ status: 'ok', monthly: 97.5 });
  });

  test('Dacia Duster a GPL de 2025 sem CO2 no anúncio', () => {
    const { car, iuc, fuel } = estimate(adverts.daciaDusterGpl2025);
    expect(car).toMatchObject({ fuel: 'lpg', engineCc: 999, km: 27693 });
    expect(iuc).toMatchObject({ status: 'missing', missing: ['co2'], min: 111.46, max: 527.57 });
    expect(fuel).toMatchObject({ status: 'ok', monthly: 85, notes: ['lpg_always_on_lpg'] });
  });
});

describe('carregar o anúncio da página', () => {
  const advert = adverts.bmw520d2026;
  const location = { href: advert.url, pathname: pathOf(advert) };
  const neverFetch = () => {
    throw new Error('não devia ir à rede');
  };

  test('usa o JSON embutido quando é do anúncio atual', async () => {
    const loaded = await site.loadAdvert({ doc: documentWith(advert), location, fetchPage: neverFetch });
    expect(loaded.id).toBe(advert.id);
  });

  test('se o JSON embutido for de outro anúncio vai buscar a página atual', async () => {
    const requested = [];
    const loaded = await site.loadAdvert({
      doc: documentWith(adverts.hondaPrelude1998),
      location,
      fetchPage: async (url) => {
        requested.push(url);
        return { ok: true, text: async () => 'html do anúncio' };
      },
      parseHtml: () => documentWith(advert),
    });
    expect(requested).toEqual([advert.url]);
    expect(loaded.id).toBe(advert.id);
  });

  test('sem JSON embutido (veio de uma lista) também vai buscar a página', async () => {
    const loaded = await site.loadAdvert({
      doc: emptyDocument,
      location,
      fetchPage: async () => ({ ok: true, text: async () => '' }),
      parseHtml: () => documentWith(advert),
    });
    expect(loaded.id).toBe(advert.id);
  });

  test('se o pedido falhar ou vier outro anúncio devolve null', async () => {
    const failed = await site.loadAdvert({
      doc: emptyDocument,
      location,
      fetchPage: async () => ({ ok: false, text: async () => '' }),
    });
    expect(failed).toBeNull();

    const wrong = await site.loadAdvert({
      doc: emptyDocument,
      location,
      fetchPage: async () => ({ ok: true, text: async () => '' }),
      parseHtml: () => documentWith(adverts.hondaPrelude1998),
    });
    expect(wrong).toBeNull();
  });

  test('JSON estragado não rebenta', async () => {
    const broken = { getElementById: () => ({ textContent: '{isto não é json' }) };
    const loaded = await site.loadAdvert({
      doc: broken,
      location,
      fetchPage: async () => ({ ok: true, text: async () => '' }),
      parseHtml: () => broken,
    });
    expect(loaded).toBeNull();
  });

  test('fora de um anúncio não faz nada', async () => {
    const loaded = await site.loadAdvert({
      doc: documentWith(advert),
      location: { href: 'https://www.standvirtual.com/carros', pathname: '/carros' },
      fetchPage: neverFetch,
    });
    expect(loaded).toBeNull();
  });
});
