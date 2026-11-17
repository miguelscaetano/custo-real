(() => {
  const ns = (globalThis.CustoReal ??= {});

  // valores em euros para 2026: Código do IUC na redação da Lei n.º 82/2023 (o OE 2026 não os atualizou)
  // e adicional do gasóleo do art.º 216.º da Lei n.º 82-B/2014, mantido pelo OE 2026
  // para atualizar noutro ano basta copiar este ficheiro e mudar os números
  const IUC_TABLES = {
    year: 2026,

    // abaixo deste valor o imposto não é cobrado (art.º 16.º)
    minimumCharge: 10,

    // art.º 9.º: 1.ª matrícula de 1981 até 30 de junho de 2007
    categoryA: {
      // limite superior de cada escalão de cilindrada (cm3)
      gasolineBrackets: [1000, 1300, 1750, 2600, 3500, Infinity],
      otherFuelBrackets: [1500, 2000, 3000, Infinity],
      // por escalão: [posterior a 1995, de 1990 a 1995, de 1981 a 1989]
      rates: [
        [19.9, 12.55, 8.8],
        [39.95, 22.45, 12.55],
        [62.4, 34.87, 17.49],
        [158.31, 83.49, 36.09],
        [287.49, 156.54, 79.72],
        [512.23, 263.11, 120.9],
      ],
      // adicional do gasóleo, pelos escalões de otherFuelBrackets
      dieselSurcharge: [
        [3.14, 1.98, 1.39],
        [6.31, 3.55, 1.98],
        [9.86, 5.51, 2.76],
        [25.01, 13.19, 5.7],
      ],
    },

    // art.º 10.º: 1.ª matrícula a partir de 1 de julho de 2007
    categoryB: {
      engine: [
        { upTo: 1250, rate: 31.77, dieselSurcharge: 5.02 },
        { upTo: 1750, rate: 63.74, dieselSurcharge: 10.07 },
        { upTo: 2500, rate: 127.35, dieselSurcharge: 20.12 },
        { upTo: Infinity, rate: 435.84, dieselSurcharge: 68.85 },
      ],
      // extraFrom2017 é a taxa adicional do n.º 2 para matrículas posteriores a 1 de janeiro de 2017
      co2: [
        { nedcUpTo: 120, wltpUpTo: 140, rate: 65.15, extraFrom2017: 0 },
        { nedcUpTo: 180, wltpUpTo: 205, rate: 97.63, extraFrom2017: 0 },
        { nedcUpTo: 250, wltpUpTo: 260, rate: 212.04, extraFrom2017: 31.77 },
        { nedcUpTo: Infinity, wltpUpTo: Infinity, rate: 363.25, extraFrom2017: 63.74 },
      ],
      extraCo2FromYear: 2017,
      // coeficiente do n.º 3 pelo ano da 1.ª matrícula, 2010 e seguintes usam o defaultCoefficient
      coefficients: { 2007: 1, 2008: 1.05, 2009: 1.1 },
      defaultCoefficient: 1.15,
    },
  };

  ns.iucTables = IUC_TABLES;
  if (typeof module !== 'undefined') module.exports = IUC_TABLES;
})();
