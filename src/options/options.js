(() => {
  const { DEFAULT_OPTIONS, KWH_PRESETS, isValidOption } = globalThis.CustoReal.defaults;
  const { AUTO_KEYS, PRICE_SETTINGS_DEFAULTS, sanitizePriceSettings } = globalThis.CustoReal.prices;
  const { DISTRICTS } = globalThis.CustoReal.dgeg;

  const form = document.getElementById('options-form');
  const status = document.getElementById('status');
  const priceStatus = document.getElementById('price-status');
  const districtSelect = document.getElementById('district');
  const presetSelect = document.getElementById('kwh-preset');
  const refreshButton = document.getElementById('refresh');
  const keys = Object.keys(DEFAULT_OPTIONS);
  const autoOptionKeys = Object.values(AUTO_KEYS);
  const dateTimeFormat = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' });

  let manualOptions = { ...DEFAULT_OPTIONS };
  let autoPrices = null;
  let lastPriceStatus = null;

  const isAuto = () => form.elements.priceMode.value === 'auto';

  function addOption(select, value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }

  function fillSelects() {
    addOption(districtSelect, '', 'Média do continente');
    for (const name of DISTRICTS) addOption(districtSelect, name, name);
    for (const preset of KWH_PRESETS) addOption(presetSelect, String(preset.price), preset.label);
    addOption(presetSelect, 'custom', 'Outro valor');
  }

  function syncPreset() {
    const value = Number(form.elements.kwhPrice.value.replace(',', '.'));
    const match = KWH_PRESETS.find((preset) => preset.price === value);
    presetSelect.value = match ? String(match.price) : 'custom';
  }

  // em modo automático as caixas dos combustíveis mostram o preço obtido e ficam bloqueadas
  function renderPriceInputs() {
    const auto = isAuto();
    for (const [energy, key] of Object.entries(AUTO_KEYS)) {
      const input = form.elements[key];
      const fetched = autoPrices?.[energy];
      input.disabled = auto;
      input.classList.remove('invalid');
      input.value = auto && isValidOption(fetched) ? fetched : manualOptions[key];
    }
    districtSelect.disabled = !auto;
    refreshButton.disabled = !auto;
  }

  function renderPriceStatus() {
    priceStatus.classList.remove('error');
    if (!isAuto()) {
      priceStatus.textContent = 'Valores escritos por si.';
      return;
    }
    if (lastPriceStatus && !lastPriceStatus.ok) {
      priceStatus.classList.add('error');
      priceStatus.textContent = `Não foi possível obter os preços da DGEG (${lastPriceStatus.message}). Estão a ser usados os valores manuais.`;
      return;
    }
    if (!autoPrices) {
      priceStatus.textContent = 'Ainda não há preços da DGEG guardados.';
      return;
    }
    const where = autoPrices.scope === 'district' ? `dos postos de ${autoPrices.district}` : 'dos postos do continente';
    priceStatus.textContent = `Média ${where}, atualizada a ${dateTimeFormat.format(autoPrices.fetchedAt)}.`;
  }

  function fillForm(options, settings) {
    manualOptions = { ...options };
    for (const key of keys) {
      form.elements[key].value = options[key];
      form.elements[key].classList.remove('invalid');
    }
    form.elements.priceMode.value = settings.priceMode;
    districtSelect.value = settings.district;
    renderPriceInputs();
    renderPriceStatus();
    syncPreset();
  }

  function showStatus(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('error', isError);
  }

  function readForm() {
    const options = {};
    let valid = true;
    for (const key of keys) {
      if (isAuto() && autoOptionKeys.includes(key)) continue;
      const input = form.elements[key];
      const value = Number(input.value.replace(',', '.'));
      const ok = input.value.trim() !== '' && isValidOption(value);
      input.classList.toggle('invalid', !ok);
      if (ok) options[key] = value;
      else valid = false;
    }
    return valid ? options : null;
  }

  const readPriceSettings = () => sanitizePriceSettings({ priceMode: form.elements.priceMode.value, district: districtSelect.value });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const options = readForm();
    if (!options) {
      showStatus('Há valores em falta ou inválidos. Todos têm de ser maiores que zero.', true);
      return;
    }
    await chrome.storage.sync.set({ ...options, ...readPriceSettings() });
    Object.assign(manualOptions, options);
    showStatus('Guardado.');
  });

  form.elements.priceMode.addEventListener('change', () => {
    renderPriceInputs();
    renderPriceStatus();
  });

  for (const key of autoOptionKeys) {
    form.elements[key].addEventListener('input', () => {
      const value = Number(form.elements[key].value.replace(',', '.'));
      if (!isAuto() && isValidOption(value)) manualOptions[key] = value;
    });
  }

  presetSelect.addEventListener('change', () => {
    if (presetSelect.value !== 'custom') form.elements.kwhPrice.value = presetSelect.value;
  });
  form.elements.kwhPrice.addEventListener('input', syncPreset);

  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'A atualizar...';
    try {
      await chrome.storage.sync.set(readPriceSettings());
      const reply = await chrome.runtime.sendMessage({ type: 'refreshPrices', force: true });
      if (reply && !reply.ok) showStatus('Não foi possível atualizar, veja a mensagem acima.', true);
      else showStatus('');
    } catch (error) {
      showStatus('Não foi possível falar com a extensão, tente reabrir esta página.', true);
    } finally {
      refreshButton.textContent = 'Atualizar agora';
      refreshButton.disabled = !isAuto();
    }
  });

  document.getElementById('reset').addEventListener('click', async () => {
    await chrome.storage.sync.set({ ...DEFAULT_OPTIONS, ...PRICE_SETTINGS_DEFAULTS });
    fillForm(DEFAULT_OPTIONS, PRICE_SETTINGS_DEFAULTS);
    showStatus('Valores por defeito repostos.');
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.autoPrices || changes.priceStatus)) return;
    chrome.storage.local.get({ autoPrices: null, priceStatus: null }).then((local) => {
      autoPrices = local.autoPrices;
      lastPriceStatus = local.priceStatus;
      renderPriceInputs();
      renderPriceStatus();
    });
  });

  async function load() {
    fillSelects();
    const [stored, local] = await Promise.all([
      chrome.storage.sync.get({ ...DEFAULT_OPTIONS, ...PRICE_SETTINGS_DEFAULTS }),
      chrome.storage.local.get({ autoPrices: null, priceStatus: null }),
    ]);
    autoPrices = local.autoPrices;
    lastPriceStatus = local.priceStatus;
    fillForm(stored, sanitizePriceSettings(stored));
  }

  load();
})();
