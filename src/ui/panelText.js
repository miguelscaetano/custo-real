(() => {
  const ns = (globalThis.CustoReal ??= {});

  const euroFormat = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
  const wholeEuroFormat = new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  });
  const numberFormat = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3 });
  const priceFormat = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

  const euro = (value) => euroFormat.format(value);
  const wholeEuro = (value) => wholeEuroFormat.format(value);

  const MISSING_LABELS = {
    engineCc: 'a cilindrada',
    co2: 'o CO₂',
    firstRegistration: 'a data da 1.ª matrícula',
    fuel: 'o combustível',
  };

  const ENERGY_LABELS = { gasoline: 'Gasolina', diesel: 'Gasóleo', lpg: 'GPL', electric: 'Eletricidade' };

  const NOTE_TEXTS = {
    imported:
      'Carro importado: a estimativa assume que o ano do anúncio é o da 1.ª matrícula (em Portugal ou noutro país da UE/EEE). Se não for, o IUC pode ser diferente.',
    co2_standard_uncertain:
      'Em carros de 2018 e 2019 o CO₂ pode estar medido em NEDC ou em WLTP. O intervalo cobre os dois casos.',
    category_uncertain_2007:
      'Sem o mês de 2007 não dá para saber se o carro é da categoria A (até junho) ou B (desde julho).',
    historic_exemption_possible:
      'Com 30 anos ou mais, pode ficar isento se for certificado como veículo de interesse histórico.',
    commercial_consumption:
      'O consumo por defeito é o de um carro ligeiro. Num comercial costuma ser mais alto, por isso ajuste-o nas opções.',
    lpg_always_on_lpg: 'Assume que o carro circula sempre a GPL, com o consumo definido nas opções.',
    co2_manual: 'IUC calculado com o CO₂ que indicou.',
  };

  const dateFormat = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'numeric', year: 'numeric' });

  const FOOTER =
    'Estimativa com as tabelas de 2026, não substitui o Portal das Finanças. Para mudar os km e os preços, clique no ícone da extensão.';

  function describeMissing(missing) {
    const labels = missing.map((key) => MISSING_LABELS[key]);
    return `${labels.length > 1 ? 'Faltam' : 'Falta'} ${labels.join(' e ')} para calcular o IUC.`;
  }

  function iucBreakdownText(iuc) {
    const b = iuc.breakdown;
    if (iuc.category === 'A') {
      const surcharge = b.dieselSurcharge ? ` + ${euro(b.dieselSurcharge)} de adicional do gasóleo` : '';
      return `Categoria A (matrícula até junho de 2007): ${euro(b.rate)} da tabela${surcharge}`;
    }
    const extra = b.co2Extra ? ` + adicional de CO₂ ${euro(b.co2Extra)}` : '';
    const diesel = b.dieselSurcharge ? ` + gasóleo ${euro(b.dieselSurcharge)}` : '';
    const coefficient = numberFormat.format(b.coefficient);
    return `Categoria B: (cilindrada ${euro(b.engineRate)} + CO₂ ${euro(b.co2Rate)}${extra}) × ${coefficient}${diesel}`;
  }

  function describeIuc(iuc) {
    if (iuc.status === 'declared') {
      return {
        headline: `≈ ${euro(iuc.amount)}/ano`,
        detail: 'Valor indicado no anúncio, não foi calculado pela extensão. Confirme no simulador do Portal das Finanças.',
        askCo2: false,
      };
    }
    if (iuc.status === 'unsupported' && iuc.reason === 'commercial') {
      return {
        headline: 'Não estimado',
        detail: 'Num veículo comercial o IUC depende do peso bruto e da categoria. Use o simulador do Portal das Finanças.',
        askCo2: false,
      };
    }
    if (iuc.status === 'ok') {
      return { headline: `≈ ${euro(iuc.amount)}/ano`, detail: iucBreakdownText(iuc), askCo2: false };
    }
    if (iuc.status === 'range') {
      return {
        headline: `≈ ${euro(iuc.min)} a ${euro(iuc.max)}/ano`,
        detail: 'O valor exato depende de um dado que o anúncio não indica (ver notas).',
        askCo2: false,
      };
    }
    if (iuc.status === 'exempt') {
      const details = {
        electric: 'Os carros 100 % elétricos não pagam IUC.',
        pre1981: 'Carros com matrícula anterior a 1981 não pagam IUC.',
        below_minimum: 'O valor calculado é inferior a 10 €, por isso não é cobrado.',
      };
      return { headline: 'Isento', detail: details[iuc.reason], askCo2: false };
    }
    if (iuc.status === 'missing') {
      const needsCo2 = iuc.missing.includes('co2') && iuc.min !== null;
      const range = needsCo2
        ? ` Com esta cilindrada fica entre ≈ ${euro(iuc.min)} e ${euro(iuc.max)} por ano.`
        : '';
      return {
        headline: needsCo2 ? 'Falta o CO₂' : 'Faltam dados',
        detail: describeMissing(iuc.missing) + range,
        askCo2: needsCo2,
      };
    }
    return {
      headline: 'Não suportado',
      detail: 'Este tipo de combustível ainda não é suportado nesta versão.',
      askCo2: false,
    };
  }

  function describeFuel(fuel, auto) {
    if (fuel.status === 'ok') {
      const isElectric = fuel.energy === 'electric';
      const unit = isElectric ? 'kWh/100 km' : 'l/100 km';
      const source = fuel.consumptionSource === 'ad' ? 'do anúncio' : 'valor por defeito';
      const usesAuto = auto?.energies.includes(fuel.energy) ?? false;
      const price = `${priceFormat.format(fuel.unitPrice)} ${isElectric ? '€/kWh' : '€/l'}${usesAuto ? ' (DGEG)' : ''}`;
      return {
        headline: `≈ ${wholeEuro(fuel.monthly)}/mês`,
        detail: [
          ENERGY_LABELS[fuel.energy],
          `${numberFormat.format(fuel.kmPerMonth)} km/mês`,
          `${numberFormat.format(fuel.consumption.value)} ${unit} (${source})`,
          price,
        ].join(' · '),
      };
    }
    if (fuel.status === 'missing') {
      return { headline: 'Faltam dados', detail: 'O anúncio não indica o combustível.' };
    }
    if (fuel.reason === 'plugin_hybrid') {
      return {
        headline: 'Depende do uso',
        detail: 'Num híbrido plug-in o custo muda muito com a frequência com que se carrega a bateria, por isso não dá para estimar só com o anúncio.',
      };
    }
    return { headline: 'Não estimado', detail: 'Este tipo de combustível ainda não é suportado nesta versão.' };
  }

  function describeAutoPrice({ scope, district, fetchedAt }) {
    const where = scope === 'district' ? `dos postos de ${district}` : 'dos postos do continente';
    return `Preço médio ${where} no portal da DGEG, a ${dateFormat.format(fetchedAt)}. É o preço afixado, sem descontos de cartão.`;
  }

  function buildSummary(iuc, fuel) {
    const parts = [];
    if (iuc.status === 'ok' || iuc.status === 'declared') parts.push(`IUC ≈ ${wholeEuro(iuc.amount)}`);
    if (iuc.status === 'exempt') parts.push('IUC isento');
    if (fuel.status === 'ok') parts.push(`≈ ${wholeEuro(fuel.monthly)}/mês`);
    return parts.join(' · ');
  }

  // transforma os resultados dos cálculos nos textos que o painel mostra
  function buildView({ iuc, fuel, co2IsManual = false, auto = null, commercial = false }) {
    const noteCodes = [...iuc.notes, ...fuel.notes];
    if (co2IsManual) noteCodes.push('co2_manual');
    if (commercial && fuel.status === 'ok' && fuel.consumptionSource === 'default') noteCodes.push('commercial_consumption');
    const notes = noteCodes.map((code) => NOTE_TEXTS[code]).filter(Boolean);
    if (fuel.status === 'ok' && auto?.energies.includes(fuel.energy)) notes.push(describeAutoPrice(auto));
    return {
      iuc: { label: 'IUC', ...describeIuc(iuc) },
      fuel: { label: 'Combustível', ...describeFuel(fuel, auto) },
      notes,
      summary: buildSummary(iuc, fuel),
      footer: FOOTER,
    };
  }

  ns.panelText = { buildView };
  if (typeof module !== 'undefined') module.exports = ns.panelText;
})();
