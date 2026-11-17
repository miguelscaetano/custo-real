(() => {
  const ns = (globalThis.CustoReal ??= {});

  const AUTO_KEYS = {
    gasoline: 'gasolinePrice',
    diesel: 'dieselPrice',
    lpg: 'lpgPrice',
  };

  const PRICE_SETTINGS_DEFAULTS = Object.freeze({ priceMode: 'auto', district: '' });

  function sanitizePriceSettings(stored) {
    return {
      priceMode: stored?.priceMode === 'manual' ? 'manual' : 'auto',
      district: typeof stored?.district === 'string' ? stored.district : '',
    };
  }

  function isUsablePrice(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  // em modo automático os preços da dgeg passam por cima dos das opções, combustível a combustível
  function resolveOptions({ options, priceMode, autoPrices }) {
    if (priceMode !== 'auto' || !autoPrices) return { options, auto: null };
    const merged = { ...options };
    const energies = [];
    for (const [energy, optionKey] of Object.entries(AUTO_KEYS)) {
      if (isUsablePrice(autoPrices[energy])) {
        merged[optionKey] = autoPrices[energy];
        energies.push(energy);
      }
    }
    if (energies.length === 0) return { options, auto: null };
    return {
      options: merged,
      auto: { energies, scope: autoPrices.scope, district: autoPrices.district, fetchedAt: autoPrices.fetchedAt },
    };
  }

  ns.prices = { AUTO_KEYS, PRICE_SETTINGS_DEFAULTS, sanitizePriceSettings, resolveOptions };
  if (typeof module !== 'undefined') module.exports = ns.prices;
})();
