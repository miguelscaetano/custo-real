const dgeg = require('../src/data/dgeg.js');

// respostas simuladas com o formato que se espera da api, ainda não confirmado contra a real
const tipos = {
  status: true,
  resultado: [
    { Id: 2101, Descritivo: 'Gasóleo simples' },
    { Id: 2105, Descritivo: 'Gasóleo colorido e marcado' },
    { Id: 3201, Descritivo: 'Gasolina simples 95' },
    { Id: 3205, Descritivo: 'Gasolina especial 95' },
    { Id: 1120, Descritivo: 'GPL Auto' },
  ],
};
const distritos = { status: true, resultado: [{ Id: 18, Descritivo: 'Viseu' }, { Id: 11, Descritivo: 'Lisboa' }] };

function station(id, price) {
  return { Id: id, Nome: `Posto ${id}`, Preco: price };
}

function makeFetch(pricesByType, calls = []) {
  return async (url) => {
    calls.push(url);
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith('/GetTiposCombustiveis')) return tipos;
    if (pathname.endsWith('/GetDistritos')) return distritos;
    const list = pricesByType[searchParams.get('idsTiposComb')] ?? [];
    const page = Number(searchParams.get('pagina'));
    const size = Number(searchParams.get('qtdPorPagina'));
    return { status: true, resultado: list.slice((page - 1) * size, page * size) };
  };
}

describe('parsePrice', () => {
  test.each([
    ['1,659 €', 1.659],
    ['1.659 €', 1.659],
    ['2,05', 2.05],
    [1.8, 1.8],
    ['', null],
    ['n/d', null],
    [null, null],
  ])('%o dá %o', (input, expected) => {
    expect(dgeg.parsePrice(input)).toBe(expected);
  });
});

describe('averagePrice', () => {
  test('faz a média em milésimas e ignora duplicados', () => {
    const stations = [station(1, '1,600 €'), station(2, '1,700 €'), station(3, '1,800 €'), station(3, '9,999 €')];
    expect(dgeg.averagePrice(stations, 'diesel')).toBe(1.7);
  });

  test('ignora preços fora do intervalo plausível', () => {
    const stations = [station(1, '1,600 €'), station(2, '1,700 €'), station(3, '1,800 €'), station(4, '0,159 €'), station(5, '16,0 €')];
    expect(dgeg.averagePrice(stations, 'diesel')).toBe(1.7);
  });

  test('com menos de 3 postos válidos não devolve média', () => {
    expect(dgeg.averagePrice([station(1, '1,6 €'), station(2, '1,7 €')], 'diesel')).toBeNull();
  });

  test('aceita nomes de campo em minúsculas', () => {
    const stations = [1, 2, 3].map((id) => ({ id, preco: '1,500 €' }));
    expect(dgeg.averagePrice(stations, 'gasoline')).toBe(1.5);
  });
});

describe('fetchPrices', () => {
  const stations = {
    2101: [station(1, '1,600 €'), station(2, '1,700 €'), station(3, '1,800 €')],
    3201: [station(4, '1,800 €'), station(5, '1,900 €'), station(6, '2,000 €')],
    1120: [station(7, '0,900 €'), station(8, '1,000 €'), station(9, '1,100 €')],
  };

  test('devolve a média de cada combustível para o distrito pedido', async () => {
    const calls = [];
    const result = await dgeg.fetchPrices({ fetchJson: makeFetch(stations, calls), districtName: 'Viseu', now: 5 });
    expect(result).toEqual({ gasoline: 1.9, diesel: 1.7, lpg: 1, scope: 'district', district: 'Viseu', fetchedAt: 5 });
    expect(calls.filter((url) => url.includes('idDistrito=18')).length).toBe(3);
  });

  test('escolhe o gasóleo simples e a gasolina simples 95, não os especiais nem o colorido', async () => {
    const calls = [];
    await dgeg.fetchPrices({ fetchJson: makeFetch(stations, calls), districtName: 'Viseu' });
    const searched = calls.filter((url) => url.includes('PesquisarPostos')).map((url) => new URL(url).searchParams.get('idsTiposComb'));
    expect(searched).toEqual(['3201', '2101', '1120']);
  });

  test('o nome do distrito é comparado sem acentos nem maiúsculas', async () => {
    const result = await dgeg.fetchPrices({ fetchJson: makeFetch(stations), districtName: 'VISEU' });
    expect(result.scope).toBe('district');
  });

  test('sem distrito pedido usa a média do continente', async () => {
    const calls = [];
    const result = await dgeg.fetchPrices({ fetchJson: makeFetch(stations, calls) });
    expect(result.scope).toBe('national');
    expect(calls.some((url) => url.includes('GetDistritos'))).toBe(false);
    expect(calls.filter((url) => url.includes('idDistrito=&')).length).toBe(3);
  });

  test('distrito que a api não conhece cai para a média do continente', async () => {
    const result = await dgeg.fetchPrices({ fetchJson: makeFetch(stations), districtName: 'Atlântida' });
    expect(result.scope).toBe('national');
    expect(result.district).toBe('');
  });

  test('percorre várias páginas', async () => {
    const many = Array.from({ length: 1500 }, (_, i) => station(i + 1, '1,500 €'));
    const calls = [];
    const result = await dgeg.fetchPrices({ fetchJson: makeFetch({ 2101: many }, calls), districtName: 'Viseu' });
    expect(result.diesel).toBe(1.5);
    expect(calls.filter((url) => url.includes('idsTiposComb=2101')).length).toBe(2);
  });

  test('não fica preso se a api ignorar a paginação', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => station(i + 1, '1,500 €'));
    let pages = 0;
    const fetchJson = async (url) => {
      if (url.includes('GetTiposCombustiveis')) return tipos;
      pages += 1;
      return { resultado: full };
    };
    const result = await dgeg.fetchPrices({ fetchJson });
    expect(result.diesel).toBe(1.5);
    expect(pages <= 6).toBe(true);
  });

  test('um combustível sem postos fica a null e os outros mantêm-se', async () => {
    const result = await dgeg.fetchPrices({ fetchJson: makeFetch({ 2101: stations[2101] }), districtName: 'Viseu' });
    expect(result).toMatchObject({ diesel: 1.7, gasoline: null, lpg: null });
  });

  test('falha quando não há nenhum preço utilizável', async () => {
    let message = null;
    try {
      await dgeg.fetchPrices({ fetchJson: makeFetch({}), districtName: 'Viseu' });
    } catch (error) {
      message = error.message;
    }
    expect(message).toContain('não devolveu preços');
  });

  test('propaga o erro de rede', async () => {
    let message = null;
    try {
      await dgeg.fetchPrices({ fetchJson: async () => { throw new Error('offline'); } });
    } catch (error) {
      message = error.message;
    }
    expect(message).toBe('offline');
  });
});

describe('DISTRICTS', () => {
  test('tem os 18 distritos do continente', () => {
    expect(dgeg.DISTRICTS.length).toBe(18);
    expect(dgeg.DISTRICTS).toContain('Viseu');
  });
});
