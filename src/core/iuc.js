(() => {
  const ns = (globalThis.CustoReal ??= {});
  const defaultTables = ns.iucTables ?? require('./iuc-tables-2026.js');

  // as contas são feitas em cêntimos inteiros para não haver erros de arredondamento
  const toCents = (euros) => Math.round(euros * 100);
  const toEuros = (cents) => cents / 100;

  function result(fields) {
    return {
      status: null,
      category: null,
      amount: null,
      min: null,
      max: null,
      reason: null,
      missing: [],
      notes: [],
      breakdown: null,
      ...fields,
    };
  }

  function resolveCategory({ year, month }) {
    if (year < 1981) return 'pre1981';
    if (year < 2007) return 'A';
    if (year > 2007) return 'B';
    if (month === null) return 'A_or_B';
    return month >= 7 ? 'B' : 'A';
  }

  function yearBand(year) {
    if (year >= 1996) return 0;
    if (year >= 1990) return 1;
    return 2;
  }

  function estimateCategoryA(car, tables, notes) {
    if (car.engineCc === null) {
      return result({ status: 'missing', category: 'A', missing: ['engineCc'], notes });
    }
    const { gasolineBrackets, otherFuelBrackets, rates, dieselSurcharge } = tables.categoryA;
    const { year } = car.firstRegistration;
    const band = yearBand(year);
    const brackets = car.combustionFuel === 'gasoline' ? gasolineBrackets : otherFuelBrackets;
    const row = brackets.findIndex((limit) => car.engineCc <= limit);
    const rate = rates[row][band];
    const surcharge = car.combustionFuel === 'diesel' ? dieselSurcharge[row][band] : 0;
    const cents = toCents(rate) + toCents(surcharge);
    const breakdown = { rate, dieselSurcharge: surcharge };
    const allNotes = tables.year - year >= 30 ? [...notes, 'historic_exemption_possible'] : notes;

    if (cents < toCents(tables.minimumCharge)) {
      return result({
        status: 'exempt', category: 'A', reason: 'below_minimum', amount: 0, notes: allNotes, breakdown,
      });
    }
    return result({ status: 'ok', category: 'A', amount: toEuros(cents), notes: allNotes, breakdown });
  }

  function categoryBAmount(car, tables, co2Row) {
    const { engine, coefficients, defaultCoefficient, extraCo2FromYear } = tables.categoryB;
    const { year } = car.firstRegistration;
    const engineRow = engine.find((row) => car.engineCc <= row.upTo);
    const co2Extra = year >= extraCo2FromYear ? co2Row.extraFrom2017 : 0;
    const coefficient = coefficients[year] ?? defaultCoefficient;
    const dieselSurcharge = car.combustionFuel === 'diesel' ? engineRow.dieselSurcharge : 0;
    // o coeficiente multiplica cilindrada, CO2 e taxa adicional de CO2, o adicional do gasóleo soma-se no fim
    const taxed = toCents(engineRow.rate) + toCents(co2Row.rate) + toCents(co2Extra);
    const cents = Math.round((taxed * Math.round(coefficient * 100)) / 100) + toCents(dieselSurcharge);
    return {
      cents,
      breakdown: {
        engineRate: engineRow.rate, co2Rate: co2Row.rate, co2Extra, coefficient, dieselSurcharge,
      },
    };
  }

  // até 2017 o CO2 era medido em NEDC e desde 2020 em WLTP, em 2018 e 2019 pode ser qualquer um
  function co2Standards(year) {
    if (year >= 2020) return ['wltp'];
    if (year <= 2017) return ['nedc'];
    return ['nedc', 'wltp'];
  }

  function estimateCategoryB(car, tables, notes) {
    if (car.engineCc === null) {
      const missing = car.co2 === null ? ['engineCc', 'co2'] : ['engineCc'];
      return result({ status: 'missing', category: 'B', missing, notes });
    }
    const co2Table = tables.categoryB.co2;

    if (car.co2 === null) {
      const lowest = categoryBAmount(car, tables, co2Table[0]);
      const highest = categoryBAmount(car, tables, co2Table.at(-1));
      return result({
        status: 'missing',
        category: 'B',
        missing: ['co2'],
        min: toEuros(lowest.cents),
        max: toEuros(highest.cents),
        notes,
      });
    }

    const options = co2Standards(car.firstRegistration.year).map((standard) => {
      const limitKey = standard === 'wltp' ? 'wltpUpTo' : 'nedcUpTo';
      const co2Row = co2Table.find((row) => car.co2 <= row[limitKey]);
      const { cents, breakdown } = categoryBAmount(car, tables, co2Row);
      return { cents, breakdown: { ...breakdown, co2Standard: standard } };
    });
    const amounts = options.map((option) => option.cents);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    if (min !== max) {
      return result({
        status: 'range',
        category: 'B',
        min: toEuros(min),
        max: toEuros(max),
        notes: [...notes, 'co2_standard_uncertain'],
      });
    }
    return result({
      status: 'ok', category: 'B', amount: toEuros(min), notes, breakdown: options[0].breakdown,
    });
  }

  function amountsOf(estimate) {
    if (estimate.status === 'ok' || estimate.status === 'exempt') return [estimate.amount];
    if (estimate.status === 'range') return [estimate.min, estimate.max];
    return null;
  }

  // em 2007 sem mês não se sabe se o carro é da categoria A ou da B, por isso mostra-se o intervalo
  function estimateUncertainCategory(car, tables, notes) {
    const allNotes = [...notes, 'category_uncertain_2007'];
    const asA = estimateCategoryA(car, tables, []);
    const asB = estimateCategoryB(car, tables, []);
    const amountsA = amountsOf(asA);
    const amountsB = amountsOf(asB);
    if (!amountsA || !amountsB) return { ...asB, category: null, notes: allNotes };
    const all = [...amountsA, ...amountsB];
    return result({ status: 'range', min: Math.min(...all), max: Math.max(...all), notes: allNotes });
  }

  function estimateIuc(car, tables = defaultTables) {
    const notes = car.imported === true ? ['imported'] : [];

    // as tabelas usadas são as da categoria A e B, os comerciais dependem do peso bruto
    if (car.commercial === true) {
      if (car.adIuc > 0) return result({ status: 'declared', reason: 'commercial', amount: car.adIuc });
      return result({ status: 'unsupported', reason: 'commercial', notes: [] });
    }
    if (car.fuel === 'electric') {
      return result({ status: 'exempt', reason: 'electric', amount: 0, notes: [] });
    }
    if (car.fuel === null) return result({ status: 'missing', missing: ['fuel'], notes });
    if (car.fuel === 'hydrogen' || car.fuel === 'other') {
      return result({ status: 'unsupported', reason: 'fuel', notes });
    }
    if (!car.firstRegistration) {
      return result({ status: 'missing', missing: ['firstRegistration'], notes });
    }

    const category = resolveCategory(car.firstRegistration);
    if (category === 'pre1981') return result({ status: 'exempt', reason: 'pre1981', amount: 0, notes: [] });
    if (category === 'A') return estimateCategoryA(car, tables, notes);
    if (category === 'B') return estimateCategoryB(car, tables, notes);
    return estimateUncertainCategory(car, tables, notes);
  }

  ns.iuc = { estimateIuc };
  if (typeof module !== 'undefined') module.exports = ns.iuc;
})();
