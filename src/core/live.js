// Live local time (Intl, no network) + optional current weather from Open-Meteo (free, no key, CC BY 4.0).
// Never throws. Weather is the one approved optional runtime fetch; any failure returns weather:null.
const TTL = 15 * 60 * 1000;

/** WMO weather_code -> { label, cloud, rain, snow, fog } (each 0..1) */
export function mapCode(code, cloudPct = 0) {
  const c = Math.max(0, Math.min(1, cloudPct / 100));
  const w = (label, cloud, rain = 0, snow = 0, fog = 0) => ({ label, cloud, rain, snow, fog });
  if (code === 0) return w('clear', Math.min(c, .15));
  if (code === 1 || code === 2) return w('partly cloudy', Math.max(.3, Math.min(c, .6)));
  if (code === 3) return w('cloudy', Math.max(.75, c));
  if (code === 45 || code === 48) return w('fog', .8, 0, 0, .85);
  if (code >= 51 && code <= 57) return w('drizzle', .8, .3);
  if ((code >= 61 && code <= 65) || (code >= 66 && code <= 67) || (code >= 80 && code <= 82)) return w('rain', .9, code === 61 || code === 80 ? .5 : code === 63 || code === 81 ? .75 : 1);
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return w('snow', .85, 0, code === 71 || code === 85 ? .5 : 1);
  if (code >= 95) return w('thunderstorm', 1, 1);
  return w(c > .6 ? 'cloudy' : 'clear', c);
}

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

async function fetchWeather(lat, lon) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  const key = `wx:${lat},${lon}`;
  try { const c = JSON.parse(store.get(key) || 'null'); if (c && Date.now() - c.at < TTL) return c.w; } catch { /* ignore */ }
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 2500);
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day,cloud_cover,precipitation,wind_speed_10m`, { signal: ac.signal });
    if (!r.ok) return null;
    const cur = (await r.json()).current; if (!cur || typeof cur.temperature_2m !== 'number') return null;
    const w = { ...mapCode(cur.weather_code, cur.cloud_cover), temp: Math.round(cur.temperature_2m), isDay: cur.is_day !== 0, wind: cur.wind_speed_10m, precip: cur.precipitation };
    store.set(key, JSON.stringify({ at: Date.now(), w })); return w;
  } catch { return null; } finally { clearTimeout(timer); }
}

function localTime(tz, hourOverride) {
  let hour = new Date().getHours(), minute = new Date().getMinutes();
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date());
    hour = +parts.find(p => p.type === 'hour').value % 24; minute = +parts.find(p => p.type === 'minute').value;
  } catch { /* fall back to browser time */ }
  if (hourOverride != null) hour = hourOverride;
  const h12 = hour % 12 || 12;
  return { hour, text: `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}` };
}

/** Test-only fake weather for ?wx=rain|snow|fog|clear (bypasses the network). */
const FAKE = { rain: { ...mapCode(63, 90), temp: 14 }, snow: { ...mapCode(73, 90), temp: -2 }, fog: { ...mapCode(45, 90), temp: 12 }, clear: { ...mapCode(0, 0), temp: 24 } };

/** liveFor(stop) -> { timeText, hour, weather|null }. Never throws. */
export async function liveFor(stop) {
  const q = new URLSearchParams(location.search), ho = q.has('hour') ? +q.get('hour') : null;
  let t; try { t = localTime(stop.tz, Number.isFinite(ho) ? ho : null); } catch { t = { hour: 12, text: '' }; }
  let weather = null;
  try {
    const fake = FAKE[q.get('wx')];
    weather = fake ? { ...fake, isDay: t.hour >= 6 && t.hour < 19 } : await fetchWeather(stop.wlat, stop.wlon);
    if (weather && !fake) weather = { ...weather };
  } catch { weather = null; }
  return { timeText: t.text, hour: t.hour, weather };
}
