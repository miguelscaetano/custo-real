importScripts('core/prices.js', 'data/dgeg.js');

const { dgeg, prices } = globalThis.CustoReal;

const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

let inFlight = null;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`a DGEG respondeu com o código ${response.status}`);
  return response.json();
}

async function runRefresh(force) {
  const settings = prices.sanitizePriceSettings(await chrome.storage.sync.get(prices.PRICE_SETTINGS_DEFAULTS));
  if (settings.priceMode !== 'auto') return { ok: true, skipped: true };

  const { autoPrices } = await chrome.storage.local.get('autoPrices');
  const isFresh =
    autoPrices &&
    autoPrices.requestedDistrict === settings.district &&
    Date.now() - autoPrices.fetchedAt < MAX_AGE_MS;
  if (isFresh && !force) return { ok: true, cached: true };

  try {
    const fetched = await dgeg.fetchPrices({ fetchJson, districtName: settings.district });
    await chrome.storage.local.set({
      autoPrices: { ...fetched, requestedDistrict: settings.district },
      priceStatus: { ok: true, at: Date.now() },
    });
    return { ok: true };
  } catch (error) {
    await chrome.storage.local.set({ priceStatus: { ok: false, at: Date.now(), message: error.message } });
    return { ok: false, error: error.message };
  }
}

// vários separadores a pedir ao mesmo tempo partilham o mesmo pedido à dgeg
function refresh(force = false) {
  inFlight ??= runRefresh(force).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'refreshPrices') return false;
  refresh(message.force === true).then(sendResponse);
  return true;
});

chrome.runtime.onStartup.addListener(() => refresh());
chrome.runtime.onInstalled.addListener(() => refresh());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.priceMode || changes.district)) refresh(true);
});
