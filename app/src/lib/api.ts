export type Currency = { code: string; name: string; symbol?: string };

const BASE =
  import.meta.env.VITE_CURRENCYBEACON_BASE || 'https://api.currencybeacon.com/v1';
const API_KEY = import.meta.env.VITE_CURRENCYBEACON_API_KEY;

type ConvertResponse = { result: number; rate?: number; meta?: Record<string, unknown> };

const ONE_DAY = 86_400_000;

/**
 * Creates a URL-encoded query string for CurrencyBeacon requests.
 *
 * Iterates over the provided params object and adds each non-nullish entry
 * to a URLSearchParams instance, appends API key
 *
 * @param params - A flat map of query parameters to include in the request URL
 * { from: 'USD', to: 'EUR', amount: 1 }
 *
 * @returns a URLSearchParams instance containing the encoded parameters and API_KEY
 */
function buildQuery(
  params: Record<string, string | number | undefined>
): URLSearchParams {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const hasValue = value !== undefined && value !== null;
    if (hasValue) query.set(key, String(value));
  }

  if (API_KEY) {
    query.set('api_key', API_KEY);
  }

  return query;
}

/**
 * Performs a GET request against the CurrencyBeacon API and returns the parsed JSON body, 
 * Also, removes any trailing slash in the URL, appends the endpoint "convert", "currencies", utilzes buildQuery
 *
 *
 * @param endpoint - path segment e.g., "convert", "currencies"
 * @param params - Key/value pairs to send as query parameters, buildQuery will URL-encode
 *
 * @returns A promise that resolves to the parsed JSON response body
 *
 * @throws Error - If the network request fails or the response status is not OK
 */
async function get(endpoint: string, params: Record<string, any> = {}) {
  const url = `${BASE.replace(/\/+$/, '')}/${endpoint}?${buildQuery(params)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j?.message || j?.error || '';
    } catch {
      msg = (await res.text().catch(() => '')).slice(0, 200);
    }
    throw new Error(`HTTP ${res.status} on ${endpoint}${msg ? ': ' + msg : ''}`);
  }
  return res.json();
}

/**
 * List of currency names.
 * If a currency name is missing but has just the code, 
 * use Intl.DisplayName to identify localised name based on currency code
 *
 * @param currencies - Array of currency objects
 *
 * @returns A new array where each currency has a full name
 */
function currencyNames(currencies: Currency[]): Currency[] {
  try {
    const displayNames = new (Intl as any).DisplayNames(['en'], { type: 'currency' });

    return currencies.map((currency) => {
      const hasMeaningfulName =
        Boolean(currency.name) && currency.name!.toUpperCase() !== currency.code;

      // Ask the browser for a localized currency name
      const localizedName = displayNames?.of?.(currency.code);

      // Choose the best name we can: keep the existing one if it's meaningful,
      // otherwise try the localized name, then fall back to the existing name or the code
      const finalName = hasMeaningfulName
        ? currency.name
        : String(localizedName ?? currency.name ?? currency.code);

      return { ...currency, name: finalName };
    });
  } catch {
    // If Intl.DisplayNames isn't supported, just return the original list unchanged
    return currencies;
  }
}

/**
 * List of currencies from API payload
 * defensive processing of data - arrays vs. objects, different field names, mixed casing,
 *
 * @param raw  - The original JSON payload returned by the API.
 * @param type - Which group to prefer when both are present: "fiat" or "crypto"
 *
 * @returns An array of normalized currencies: { code: string; name: string; symbol?: string }[]
 */
function parseCurrenciesJSON(raw: any, type: 'fiat' | 'crypto'): Currency[] {
  const sources = [
    raw?.response?.currencies,
    raw?.response?.[type],
    raw?.currencies,
    raw?.data?.currencies,
    raw?.data?.[type],
    raw?.response,
    raw, // as a last resort, try the top-level object itself
  ];

  // Accumulate unique currencies by their normalized code (e.g., "USD")
  const currencyByCode: Record<string, Currency> = {};

  // Normalize any input to an uppercase string code.
  const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();

  // Safely add/overwrite a currency candidate if it looks valid.
  const addCandidate = (codeRaw: unknown, nameRaw?: unknown, symbolRaw?: unknown) => {
    const code = normalizeCode(codeRaw);

    // Only accept plausible ISO-like alphabetic codes, 3–5 chars (e.g., "USD", "XBT")
    if (!/^[A-Z]{3,5}$/.test(code)) return;

    const name = String(nameRaw ?? code);
    const symbol = symbolRaw as string | undefined;

    currencyByCode[code] = { code, name, symbol };
  };

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    // Array of currency objects
    if (Array.isArray(source)) {
      for (const item of source) {
        const v: any = item ?? {};

        // Prefer alphabetic short code fields over numeric codes
        const code =
          v.short_code ??          // preferred (often ISO alpha)
          v.code ??                // sometimes alpha, sometimes numeric
          v.iso_code ??            // provider-specific
          v.ticker ??              // crypto
          v.currency;              // generic field

        const name =
          v.name ??
          v.currency_name ??
          v.fullName ??
          v.currency ??
          v.label ??
          code;

        const symbol = v.symbol ?? v.symbol_native ?? v.sign;

        if (code && name) addCandidate(code, name, symbol);
      }
      continue;
    }

    // Object map (keys may be codes OR numeric IDs; values can be strings or objects)
    for (const [key, value] of Object.entries(source)) {
      // map code to readable name
      if (typeof value === 'string') {
        if (/^[A-Z]{3,5}$/.test(key)) addCandidate(key, value);
        continue;
      }

      const v: any = value ?? {};
      const code =
        v.short_code ??
        v.code ??
        v.iso_code ??
        v.ticker ??
        v.currency ??
        (/^[A-Z]{3,5}$/.test(key) ? key : undefined);

      const name =
        v.name ??
        v.currency_name ??
        v.fullName ??
        v.currency ??
        v.label ??
        code;

      const symbol = v.symbol ?? v.symbol_native ?? v.sign;

      if (code && name) addCandidate(code, name, symbol);
    }
  }

  // Sort by name A-Z, then code
  return Object.values(currencyByCode).sort(
    (a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code),
  );
}

/**
 * Parses CurrencyBeacon rate and maps into { CODE: number }
 *
 * @param json - Raw JSON from CurrencyBeacon (latest, historical)
 * @returns A flat map of uppercase currency codes to numeric rates
 */
function parseRates(json: any): Record<string, number> {
  const rates = json?.rates ?? json?.response?.rates;
  if (!rates || typeof rates !== 'object') return {};

  const out: Record<string, number> = {};
  for (const [code, value] of Object.entries(rates)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[String(code).toUpperCase()] = value;
    }
  }
  return out;
}

/**
 * Fetches a list of currencies, adds display names, sorts, and caches the result in localStorage for 24 hours
 * to reduce quota usage/rate-limit risk
 *
 * @param type - which list to load: "fiat" (default) or "crypto"
 * @returns Promise resolving to a normalized array of currencies
 */
export async function getCurrencies(type: 'fiat' | 'crypto' = 'fiat'): Promise<Currency[]> {
  // Try cache first
  const cacheKey = `cb_currencies_v6_${type}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const { at, items } = JSON.parse(cached);

      // Ensure cache isn't stale and looks like a plausible currency list
      const fresh = Date.now() - at < ONE_DAY;
      const looksValid =
        Array.isArray(items) &&
        items.length > 0 &&
        (items as any[]).every((x) => /^[A-Z]{3,5}$/.test(x?.code));

      if (fresh && looksValid) {
        return items as Currency[];
      }
    } catch {
      // ignore and refetch.
    }
  }

  // Get currencies
  let list: Currency[] = [];
  try {
    const raw = await get('currencies', { type });
    list = parseCurrenciesJSON(raw, type);
  } catch {
    // ignore and try fallback below
  }

  // codes from /latest if /currencies failed
  if (!list || list.length < 5) {
    try {
      const latest = await get('latest', {});
      const rates = parseRates(latest);
      const codes = Array.from(new Set(['USD', ...Object.keys(rates)])) // seed with USD for sanity
        .filter((c) => /^[A-Z]{3,5}$/.test(c));
      list = codes.map((c) => ({ code: c, name: c })); // names filled next step
    } catch {
      // If even fallback fails, return an empty list after adding names/sort below
    }
  }

  // add names and stable sort
  list = currencyNames(list).sort(
    (a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code),
  );

  // Cache & return
  localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), items: list }));
  return list;
}

/**
 * Fallback conversion via USD using /latest 
 * Converts an amount from one currency to another by using USD as a pivot.
 *
 * @param from   code of the source currency
 * @param to     code of the target currency
 * @param amount amount in the from currency to be converted
 *
 * @returns An object with: result - numeric converted value, rate - per-unit rate, meta - info indicating this was a fallback via USD
 *
 * @throws Error if required rates are not available in the `/latest` response
 */
async function convertViaUSD(
  from: string,
  to: string,
  amount: number
): Promise<ConvertResponse> {
  // Build the minimal list of symbols we need from /latest.
  // If either side is USD, we don't need to request it (it's 1)
  const symbolsNeeded: string[] = [];
  if (from !== 'USD') symbolsNeeded.push(from);
  if (to !== 'USD') symbolsNeeded.push(to);

  // Deduplicate and join as CSV for the API
  const symbols = [...new Set(symbolsNeeded)].join(',');

  // Fetch USD-based rates; pass symbols to keep the payload small if possible
  const latest = await get('latest', symbols ? { symbols } : {});
  const rates = parseRates(latest); // e.g., { EUR: 0.91, GBP: 0.78 }

  // Resolve each side relative to USD (1 when the side is USD)
  const fromRateUSD = from === 'USD' ? 1 : rates[from];
  const toRateUSD   = to   === 'USD' ? 1 : rates[to];

  // If either side is missing, we can't compute the cross-rate
  if (typeof fromRateUSD !== 'number' || typeof toRateUSD !== 'number') {
    throw new Error('Fallback rates unavailable.');
  }

  // Cross-rate: TO/USD divided by FROM/USD.
  const perUnitRate = toRateUSD / fromRateUSD;

  return {
    result: amount * perUnitRate,
    rate: perUnitRate,
    meta: { fallback: true, base: 'USD', rates },
  };
}


/**
 * Converts a single amount using CurrencyBeacon's `/convert` endpoint,
 * and falls back to a USD cross-rate if the primary call fails
 *
 *
 * @param params - Conversion parameters.
 *   @param params.from   source currency code "USD", "GBP"
 *   @param params.to     target currency code
 *   @param params.amount Amount in the from currency to convert
 *
 * @returns Promise resolving to: result - converted numeric amount, rate - per-unit rate, meta - was it via USD?
 */
export async function convertOnce(
  params: { from: string; to: string; amount: number }
): Promise<ConvertResponse> {
  const from = String(params.from || '').trim().toUpperCase();
  const to = String(params.to || '').trim().toUpperCase();
  const amount = Number(params.amount) || 0;

  try {
    // Primary call to /convert
    const json = await get('convert', { from, to, amount });

    const result = Number(
      json?.result ??
      json?.response?.value ??
      json?.response?.result ??
      json?.data?.result ??
      json?.value
    );

    // If a finite number came back, compute a per-unit rate
    if (Number.isFinite(result)) {
      const perUnit = amount ? result / amount : undefined;
      return { result, rate: perUnit, meta: json };
    }

    // Non-numeric or missing result - treat as an unexpected
    throw new Error('Unexpected convert response shape.');
  } catch {
    // Fallback: cross-rate via USD (/latest)
    return convertViaUSD(from, to, amount);
  }
}


// Historical (chart)

export type TimeseriesPoint = { date: string; rate: number };

/**
 * Fetches a daily time series for the cross-rate 1 FROM - TO
 *
 * @param params
 *   - from:  source currency code 
 *   - to:    target currency code 
 *   - start: inclusive start date "YYYY-MM-DD"
 *   - end:   inclusive end date "YYYY-MM-DD"
 *
 * @returns Promise of sorted { date: "YYYY-MM-DD", rate: number }[]
 */
export async function getTimeseries(params: {
  from: string;
  to: string;
  start: string; 
  end: string;
}): Promise<TimeseriesPoint[]> {
  const from = params.from.trim().toUpperCase();
  const to = params.to.trim().toUpperCase();

  // single /timeseries request (USD base) 
  try {
    const json = await get('timeseries', {
      base: 'USD',
      start_date: params.start,
      end_date: params.end,
      symbols: `${from},${to}`,
    });

    // daily rates
    const buckets =
      json?.rates ?? json?.data?.rates ?? json?.response?.rates ?? {};

    // chronological order
    const dates = Object.keys(buckets).sort();

    const series: TimeseriesPoint[] = [];
    for (const d of dates) {
      const day = buckets[d] || {};
      // Resolve each side relative to USD (1 by definition when base=USD)
      const rFrom = from === 'USD' ? 1 : day[from];
      const rTo   = to   === 'USD' ? 1 : day[to];
      if (typeof rFrom === 'number' && typeof rTo === 'number') {
        series.push({ date: d, rate: rTo / rFrom });
      }
    }

    if (series.length) return series;
    // If empty/unsupported, fall through to the per-day fallback
  } catch {
    // error, try fallback below
  }

  // Fallback call /historical for each day
  const start = new Date(params.start);
  const end = new Date(params.end);

  // Build the list of YYYY-MM-DD strings for each day in the range (inclusive)
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  const results: TimeseriesPoint[] = [];
  for (const day of days) {
    try {
      const json = await get('historical', {
        base: 'USD',
        date: day,
        symbols: `${from},${to}`,
      });

      // Normalize into a { CODE: number } map
      const rates = parseRates(json);

      const rFrom = from === 'USD' ? 1 : rates[from];
      const rTo   = to   === 'USD' ? 1 : rates[to];

      if (typeof rFrom === 'number' && typeof rTo === 'number') {
        results.push({ date: day, rate: rTo / rFrom });
      }
    } catch {
      // skip day on error
    }
  }

  // Ensure chronological order and return
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

const api = { getCurrencies, convertOnce, getTimeseries };
export default api;