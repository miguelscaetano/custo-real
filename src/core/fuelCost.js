(() => {
  const ns = (globalThis.CustoReal ??= {});

  const LITRES = 'l/100km';
  const KWH = 'kWh/100km';

  // para cada combustível: que preço usar, que consumo por defeito e em que unidade
  const ENERGY = {
    gasoline: { energy: 'gasoline', priceKey: 'gasolinePrice', consumptionKey: 'gasolineConsumption', unit: LITRES },
    diesel: { energy: 'diesel', priceKey: 'dieselPrice', consumptionKey: 'dieselConsumption', unit: LITRES },
    lpg: { energy: 'lpg', priceKey: 'lpgPrice', consumptionKey: 'lpgConsumption', unit: LITRES },
    electric: { energy: 'electric', priceKey: 'kwhPrice', consumptionKey: 'electricConsumption', unit: KWH },
  };

  function result(fields) {
    return {
      status: null,
      monthly: null,
      energy: null,
      consumption: null,
      consumptionSource: null,
      unitPrice: null,
      kmPerMonth: null,
      reason: null,
      missing: [],
      notes: [],
      ...fields,
    };
  }

  function resolveEnergy(car) {
    if (car.fuel === 'hybrid') {
      const base = ENERGY[car.combustionFuel];
      return base ? { ...base, consumptionKey: 'hybridConsumption' } : null;
    }
    return ENERGY[car.fuel] ?? null;
  }

  function estimateFuelCost(car, options) {
    if (car.fuel === null) return result({ status: 'missing', missing: ['fuel'] });
    if (car.fuel === 'plugin_hybrid') return result({ status: 'unsupported', reason: 'plugin_hybrid' });

    const energy = resolveEnergy(car);
    if (!energy) return result({ status: 'unsupported', reason: 'fuel' });

    const notes = [];
    // num carro a GPL o consumo anunciado costuma ser o da gasolina, por isso usa-se sempre o das opções
    const adConsumptionApplies = car.fuel !== 'lpg' && car.consumption?.unit === energy.unit;
    if (car.fuel === 'lpg') notes.push('lpg_always_on_lpg');

    const consumption = adConsumptionApplies ? car.consumption.value : options[energy.consumptionKey];
    const unitPrice = options[energy.priceKey];
    const monthly = (options.kmPerMonth / 100) * consumption * unitPrice;

    return result({
      status: 'ok',
      monthly: Math.round(monthly * 100) / 100,
      energy: energy.energy,
      consumption: { value: consumption, unit: energy.unit },
      consumptionSource: adConsumptionApplies ? 'ad' : 'default',
      unitPrice,
      kmPerMonth: options.kmPerMonth,
      notes,
    });
  }

  ns.fuelCost = { estimateFuelCost };
  if (typeof module !== 'undefined') module.exports = ns.fuelCost;
})();
