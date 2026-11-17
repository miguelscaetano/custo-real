(() => {
  const ns = (globalThis.CustoReal ??= {});

  // preços de referência de novembro de 2026 (DGEG e ERSE), o utilizador muda-os nas opções
  const DEFAULT_OPTIONS = Object.freeze({
    kmPerMonth: 1000,
    gasolinePrice: 1.95,
    dieselPrice: 2.15,
    lpgPrice: 1.0,
    kwhPrice: 0.2,
    gasolineConsumption: 6.5,
    dieselConsumption: 5.5,
    hybridConsumption: 5,
    lpgConsumption: 8.5,
    electricConsumption: 17,
  });

  // valores médios de referência para o carregamento, o utilizador pode escrever outro
  // casa: média da tarifa regulada de 2026 (erse); público: preços médios por tipo de posto (repsol)
  const KWH_PRESETS = Object.freeze([
    { label: 'Em casa (tarifa simples)', price: 0.2 },
    { label: 'Público normal (AC)', price: 0.19 },
    { label: 'Público rápido (DC)', price: 0.28 },
    { label: 'Público ultrarrápido', price: 0.4 },
  ]);

  function isValidOption(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  // garante que nunca se calcula com valores em falta ou inválidos vindos do storage
  function sanitizeOptions(stored) {
    const options = {};
    for (const [key, fallback] of Object.entries(DEFAULT_OPTIONS)) {
      const value = Number(stored?.[key]);
      options[key] = isValidOption(value) ? value : fallback;
    }
    return options;
  }

  ns.defaults = { DEFAULT_OPTIONS, KWH_PRESETS, isValidOption, sanitizeOptions };
  if (typeof module !== 'undefined') module.exports = ns.defaults;
})();
