(() => {
  const ns = (globalThis.CustoReal ??= {});
  ns.sites ??= {};

  const HOSTNAME = 'www.standvirtual.com';
  const AD_PATH = /^\/(carros|comerciais)\/anuncio\/.+-ID([A-Za-z0-9]+)\.html$/;

  function getAdId(pathname) {
    return AD_PATH.exec(pathname)?.[2] ?? null;
  }

  // os comerciais têm outras regras de IUC, por isso o painel precisa de saber de que secção vem o anúncio
  function isCommercialPath(pathname) {
    return AD_PATH.exec(pathname)?.[1] === 'comerciais';
  }

  function isAdPage(location) {
    return location.hostname === HOSTNAME && getAdId(location.pathname) !== null;
  }

  // parametersDict traz os valores "limpos" (ex.: "2157"), details traz o texto visível (ex.: "2 157 cm3")
  function readParam(advert, key) {
    return advert.parametersDict?.[key]?.values?.[0]?.value || null;
  }

  function readDetail(advert, key) {
    return advert.details?.find((detail) => detail.key === key)?.value || null;
  }

  function read(advert, key) {
    return readParam(advert, key) ?? readDetail(advert, key);
  }

  // devolve os dados brutos do anúncio, sem os interpretar: isso é trabalho do normalizador
  function extractRawCar(advert) {
    return {
      source: 'standvirtual',
      id: advert.id ?? null,
      title: advert.title ?? null,
      price: advert.price?.value ?? null,
      currency: advert.price?.currency ?? null,
      fuelCode: readParam(advert, 'fuel_type'),
      fuelLabel: readDetail(advert, 'fuel_type'),
      registrationYear: read(advert, 'first_registration_year'),
      registrationMonth: read(advert, 'first_registration_month'),
      engineCapacity: read(advert, 'engine_capacity'),
      enginePower: read(advert, 'engine_power'),
      co2: read(advert, 'co2_emissions'),
      // aqui interessa o texto visível porque traz a unidade
      consumption: readDetail(advert, 'combined_consumption') ?? readParam(advert, 'combined_consumption'),
      mileage: read(advert, 'mileage'),
      imported: readParam(advert, 'is_imported_car'),
      origin: readParam(advert, 'origin') ?? readDetail(advert, 'origin'),
    };
  }

  // alguns anúncios de stand trazem o IUC já preenchido, em texto como "45.13"
  function readAdIuc(advert) {
    const number = Number(String(readParam(advert, 'iuc') ?? '').replace(',', '.'));
    return Number.isFinite(number) && number > 0 && number < 10000 ? number : null;
  }

  // o site é feito em Next.js e traz os dados do anúncio num JSON dentro de <script id="__NEXT_DATA__">
  function readAdvertFromDocument(doc) {
    const script = doc.getElementById('__NEXT_DATA__');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent)?.props?.pageProps?.advert ?? null;
    } catch {
      return null;
    }
  }

  function advertMatches(advert, adId) {
    return typeof advert?.url === 'string' && advert.url.includes(`-ID${adId}.html`);
  }

  function parseHtmlWithDomParser(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // numa navegação sem recarregar a página o __NEXT_DATA__ fica com os dados da página anterior,
  // nesse caso vai-se buscar o HTML do anúncio atual ao próprio standvirtual
  async function loadAdvert({ doc, location, fetchPage, parseHtml = parseHtmlWithDomParser }) {
    const adId = getAdId(location.pathname);
    if (!adId) return null;

    const embedded = readAdvertFromDocument(doc);
    if (advertMatches(embedded, adId)) return embedded;

    const response = await fetchPage(location.href);
    if (!response.ok) return null;
    const fetched = readAdvertFromDocument(parseHtml(await response.text()));
    return advertMatches(fetched, adId) ? fetched : null;
  }

  // sem âncora o painel fica flutuante num canto, para o pôr dentro da página
  // (por exemplo junto ao preço) basta devolver aqui o elemento a seguir ao qual deve ficar
  function findPanelAnchor() {
    return null;
  }

  ns.sites.standvirtual = { isAdPage, getAdId, isCommercialPath, readAdIuc, extractRawCar, loadAdvert, findPanelAnchor };
  if (typeof module !== 'undefined') module.exports = ns.sites.standvirtual;
})();
