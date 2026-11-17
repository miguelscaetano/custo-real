(() => {
  // protege contra o script ser injetado duas vezes na mesma página
  if (globalThis.__custoRealStarted) return;
  globalThis.__custoRealStarted = true;

  const { defaults, prices, normalize, iuc, fuelCost, sites, panel, panelText } = globalThis.CustoReal;
  const site = sites.standvirtual;

  let options = { ...defaults.DEFAULT_OPTIONS };
  let priceMode = prices.PRICE_SETTINGS_DEFAULTS.priceMode;
  let autoPrices = null;
  let collapsed = false;
  let currentAd = null;
  let lastPath = null;
  let updateCount = 0;
  const manualCo2ByAd = new Map();

  function render() {
    if (!currentAd) return;
    const manualCo2 = manualCo2ByAd.get(currentAd.id);
    const car = manualCo2 ? { ...currentAd.car, co2: manualCo2 } : currentAd.car;
    const resolved = prices.resolveOptions({ options, priceMode, autoPrices });
    const view = panelText.buildView({
      iuc: iuc.estimateIuc(car),
      fuel: fuelCost.estimateFuelCost(car, resolved.options),
      co2IsManual: Boolean(manualCo2),
      auto: resolved.auto,
      commercial: car.commercial === true,
    });
    panel.render(view, {
      collapsed,
      anchor: site.findPanelAnchor(document),
      onToggle: toggleCollapsed,
      onCo2: (co2) => {
        manualCo2ByAd.set(currentAd.id, co2);
        render();
      },
    });
  }

  function toggleCollapsed() {
    collapsed = !collapsed;
    render();
    chrome.storage.local.set({ panelCollapsed: collapsed }).catch(() => {});
  }

  function clear() {
    currentAd = null;
    panel.remove();
  }

  async function update() {
    const thisUpdate = ++updateCount;
    if (!site.isAdPage(location)) {
      clear();
      return;
    }

    let advert = null;
    try {
      advert = await site.loadAdvert({
        doc: document,
        location,
        fetchPage: (url) => fetch(url, { credentials: 'same-origin' }),
      });
    } catch (error) {
      console.warn('[Custo Real] não foi possível ler os dados do anúncio', error);
    }
    // se entretanto o utilizador mudou de página, este resultado já não interessa
    if (thisUpdate !== updateCount) return;
    if (!advert) {
      clear();
      return;
    }

    currentAd = {
      id: site.getAdId(location.pathname),
      car: {
        ...normalize.normalizeCar(site.extractRawCar(advert)),
        commercial: site.isCommercialPath(location.pathname),
        adIuc: site.readAdIuc(advert),
      },
    };
    render();
  }

  function checkPage() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      update();
    } else if (currentAd && !panel.isAttached()) {
      render();
    }
  }

  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get({ ...defaults.DEFAULT_OPTIONS, ...prices.PRICE_SETTINGS_DEFAULTS });
      options = defaults.sanitizeOptions(stored);
      priceMode = prices.sanitizePriceSettings(stored).priceMode;
      const local = await chrome.storage.local.get({ panelCollapsed: false, autoPrices: null });
      collapsed = local.panelCollapsed === true;
      autoPrices = local.autoPrices;
    } catch (error) {
      console.warn('[Custo Real] não foi possível ler as opções, a usar os valores por defeito', error);
    }
  }

  // o site muda de página sem recarregar, por isso vigia-se o DOM e confirma-se se o endereço mudou
  function watchNavigation() {
    let pending = null;
    const observer = new MutationObserver(() => {
      if (pending !== null) return;
      pending = setTimeout(() => {
        pending = null;
        checkPage();
      }, 300);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', checkPage);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' || (area === 'local' && changes.autoPrices)) loadSettings().then(render);
  });

  loadSettings().then(() => {
    checkPage();
    watchNavigation();
    // o service worker só vai à dgeg se os preços guardados já estiverem velhos
    chrome.runtime.sendMessage({ type: 'refreshPrices' }).catch(() => {});
  });
})();
