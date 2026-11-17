(() => {
  const ns = (globalThis.CustoReal ??= {});

  const BASE_URL = 'https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb';
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 10;
  // com menos postos do que isto a média diz mais sobre a amostra do que sobre a zona
  const MIN_STATIONS = 3;

  const DISTRICTS = [
    'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro', 'Guarda',
    'Leiria', 'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu',
  ];

  // intervalos plausíveis em €/l, fora deles o preço é erro de digitação de um posto
  const FUELS = {
    gasoline: {
      limits: [0.8, 4],
      match: (name) => name.includes('gasolina') && name.includes('95') && name.includes('simples') && !name.includes('especial'),
    },
    diesel: {
      limits: [0.8, 4],
      match: (name) => name.includes('gasoleo') && name.includes('simples'),
    },
    lpg: {
      limits: [0.3, 2.5],
      match: (name) => name.includes('gpl') && name.includes('auto'),
    },
  };

  function normalizeName(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // a api devolve a lista dentro de um objeto, o nome da propriedade varia por endpoint
  function extractList(json) {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== 'object') return [];
    for (const key of Object.keys(json)) {
      if (/^(resultado|result|data|items)$/i.test(key) && Array.isArray(json[key])) return json[key];
    }
    return [];
  }

  function findField(item, pattern) {
    const key = Object.keys(item ?? {}).find((name) => pattern.test(name) && item[name] !== null && item[name] !== '');
    return key === undefined ? undefined : item[key];
  }

  function itemId(item) {
    return findField(item, /^id$/i) ?? findField(item, /^id/i);
  }

  function itemName(item) {
    const named = findField(item, /^(nome|descritivo|descricao|designacao)/i);
    return named ?? Object.values(item ?? {}).find((value) => typeof value === 'string');
  }

  // aceita 1.659, "1,659 €" e "1.659 €"
  function parsePrice(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const cleaned = value.replace(/[^\d,.]/g, '').replace(',', '.');
    const number = Number(cleaned);
    return cleaned !== '' && Number.isFinite(number) ? number : null;
  }

  function findByName(list, wanted) {
    const target = normalizeName(wanted);
    return list.find((item) => normalizeName(itemName(item)) === target);
  }

  // média dos postos em milésimas de euro, sem duplicados e sem preços absurdos
  function averagePrice(stations, fuelKey) {
    const [min, max] = FUELS[fuelKey].limits;
    const seen = new Set();
    let total = 0;
    let count = 0;
    stations.forEach((station, index) => {
      const id = itemId(station) ?? `sem-id-${index}`;
      if (seen.has(id)) return;
      seen.add(id);
      const price = parsePrice(findField(station, /^(preco|price)/i));
      if (price === null || price < min || price > max) return;
      total += Math.round(price * 1000);
      count += 1;
    });
    return count >= MIN_STATIONS ? Math.round(total / count) / 1000 : null;
  }

  function buildUrl(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    return `${BASE_URL}/${path}${query ? `?${query}` : ''}`;
  }

  async function fetchStations({ fetchJson, typeId, districtId }) {
    const stations = [];
    let previousFirst = null;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const json = await fetchJson(
        buildUrl('PesquisarPostos', {
          idsTiposComb: typeId,
          idMarca: '',
          idTipoPosto: '',
          idDistrito: districtId,
          idsMunicipios: '',
          qtdPorPagina: PAGE_SIZE,
          pagina: page,
        }),
      );
      const list = extractList(json);
      const first = list.length ? itemId(list[0]) : null;
      // se a api ignorar a paginação devolve sempre a mesma página
      if (page > 1 && first !== null && first === previousFirst) break;
      previousFirst = first;
      stations.push(...list);
      if (list.length < PAGE_SIZE) break;
    }
    return stations;
  }

  // devolve a média de cada combustível; fetchJson recebe o url e devolve o json já lido
  async function fetchPrices({ fetchJson, districtName = '', now = Date.now() }) {
    const types = extractList(await fetchJson(buildUrl('GetTiposCombustiveis')));
    let districtId = '';
    let scope = 'national';
    let district = '';
    if (districtName) {
      const found = findByName(extractList(await fetchJson(buildUrl('GetDistritos'))), districtName);
      if (found && itemId(found) !== undefined) {
        districtId = itemId(found);
        scope = 'district';
        district = districtName;
      }
    }

    const prices = { gasoline: null, diesel: null, lpg: null };
    for (const [key, fuel] of Object.entries(FUELS)) {
      const type = types.find((item) => fuel.match(normalizeName(itemName(item))));
      if (!type) continue;
      const stations = await fetchStations({ fetchJson, typeId: itemId(type), districtId });
      prices[key] = averagePrice(stations, key);
    }

    if (Object.values(prices).every((price) => price === null)) {
      throw new Error('a DGEG não devolveu preços utilizáveis');
    }
    return { ...prices, scope, district, fetchedAt: now };
  }

  ns.dgeg = { DISTRICTS, normalizeName, extractList, parsePrice, averagePrice, buildUrl, fetchPrices };
  if (typeof module !== 'undefined') module.exports = ns.dgeg;
})();
