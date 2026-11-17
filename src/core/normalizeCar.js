(() => {
  const ns = (globalThis.CustoReal ??= {});

  const MONTHS = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  function stripAccents(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // lê o primeiro número de textos como "1 598 cm3", "15.000 km", "5,4 l/100km" ou "19.250,00 €"
  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const compact = value.replace(/[\s  ]/g, '');
    const match = compact.match(/\d[\d.,]*/);
    if (!match) return null;
    const cleaned = match[0]
      .replace(/[.,]+$/, '')
      // um ponto ou vírgula seguido de exatamente 3 dígitos é separador de milhares
      .replace(/[.,](?=\d{3}(?!\d))/g, '')
      .replace(',', '.');
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  function within(number, min, max) {
    return number !== null && number >= min && number <= max ? number : null;
  }

  function parseFuel(code, label) {
    const text = stripAccents(`${code ?? ''} ${label ?? ''}`.toLowerCase()).trim();
    if (!text) return { fuel: null, combustionFuel: null };
    const burnsDiesel = /diesel|gasoleo/.test(text);
    if (/plug/.test(text)) {
      return { fuel: 'plugin_hybrid', combustionFuel: burnsDiesel ? 'diesel' : 'gasoline' };
    }
    if (/hibrid|hybrid/.test(text)) {
      return { fuel: 'hybrid', combustionFuel: burnsDiesel ? 'diesel' : 'gasoline' };
    }
    if (/eletric|electric/.test(text)) return { fuel: 'electric', combustionFuel: null };
    if (/gpl|lpg/.test(text)) return { fuel: 'lpg', combustionFuel: 'lpg' };
    if (/gnc|cng|gas natural/.test(text)) return { fuel: 'cng', combustionFuel: 'cng' };
    if (/hidrog|hydrog/.test(text)) return { fuel: 'hydrogen', combustionFuel: null };
    if (burnsDiesel) return { fuel: 'diesel', combustionFuel: 'diesel' };
    if (/gasolina|\bgaz\b|petrol/.test(text)) return { fuel: 'gasoline', combustionFuel: 'gasoline' };
    return { fuel: 'other', combustionFuel: null };
  }

  function parseMonth(value) {
    if (value === null || value === undefined) return null;
    const text = stripAccents(String(value).toLowerCase().trim());
    if (/^\d{1,2}$/.test(text)) return within(Number(text), 1, 12);
    if (text.length < 3) return null;
    const index = MONTHS.findIndex((month) => text.startsWith(month.slice(0, 3)));
    return index === -1 ? null : index + 1;
  }

  function parseYear(value) {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
  }

  // aceita datas como "03/2015", "15/03/2015", "2015-03-15", "março 2015" ou só "2015"
  function parseDateText(text) {
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) return null;
    const before = text.slice(0, yearMatch.index);
    const after = text.slice(yearMatch.index + 4);
    const numbersBefore = before.match(/\d{1,2}/g);
    const numbersAfter = after.match(/\d{1,2}/g);
    const monthText = numbersBefore ? numbersBefore.at(-1) : numbersAfter?.[0];
    const monthName = text.replace(/[\d/.\-]/g, ' ').trim();
    return {
      year: Number(yearMatch[0]),
      month: parseMonth(monthText) ?? parseMonth(monthName),
    };
  }

  function parseRegistration(raw) {
    const year = parseYear(raw.registrationYear);
    if (year !== null) return { year, month: parseMonth(raw.registrationMonth) };
    if (typeof raw.registrationDate === 'string') return parseDateText(raw.registrationDate);
    return null;
  }

  function parseConsumption(value, fuel) {
    const number = parseNumber(value);
    if (number === null) return null;
    const text = typeof value === 'string' ? value.toLowerCase() : '';
    // o standvirtual escreve "l/100km" mesmo nos elétricos, por isso manda o combustível
    const unit = fuel === 'electric' || text.includes('kwh') ? 'kWh/100km' : 'l/100km';
    const [min, max] = unit === 'kWh/100km' ? [5, 40] : [1, 30];
    return within(number, min, max) === null ? null : { value: number, unit };
  }

  function parseImported(raw) {
    const flag = stripAccents(String(raw.imported ?? '').toLowerCase().trim());
    if (['1', 'true', 'sim', 'yes'].includes(flag)) return true;
    if (['0', 'false', 'nao', 'no'].includes(flag)) return false;
    const origin = stripAccents(String(raw.origin ?? '').toLowerCase());
    if (origin.includes('import')) return true;
    if (/nacional|national/.test(origin)) return false;
    return null;
  }

  function roundOrNull(number) {
    return number === null ? null : Math.round(number);
  }

  function normalizeCar(raw) {
    const data = raw ?? {};
    const { fuel, combustionFuel } = parseFuel(data.fuelCode, data.fuelLabel);
    const isElectric = fuel === 'electric';
    return {
      price: within(parseNumber(data.price), 1, 10_000_000),
      firstRegistration: parseRegistration(data),
      fuel,
      combustionFuel,
      engineCc: isElectric ? null : roundOrNull(within(parseNumber(data.engineCapacity), 50, 10_000)),
      powerHp: roundOrNull(within(parseNumber(data.enginePower), 1, 2500)),
      co2: isElectric ? null : roundOrNull(within(parseNumber(data.co2), 1, 600)),
      consumption: parseConsumption(data.consumption, fuel),
      km: roundOrNull(within(parseNumber(data.mileage), 0, 2_000_000)),
      imported: parseImported(data),
    };
  }

  ns.normalize = { normalizeCar, parseNumber, parseFuel, parseMonth };
  if (typeof module !== 'undefined') module.exports = ns.normalize;
})();
