# ☀️ Kur Šviečia Saulė LT (Where is Sunny in Lithuania)

Interaktyvi internetinė aplikacija, rodanti tikslias Lietuvos vietas, kur šiuo metu (ir artimiausiomis valandomis) šviečia saulė bei vyrauja giedras dangus.

---

## 🚀 Pagrindinės Funkcijos

1. **Gyvas Lietuvos saulės žemėlapis**:
   - Visi 52 oficialūs Lietuvos hidrometeorologijos tarnybos (LHMT / `meteo.lt`) automatiniai meteorologiniai stotys (AMS) su tiksliomis GPS koordinatėmis.
   - Švytintys, animuoti saulės taškai rodantys giedras ir saulėtas vietoves.
   - Išsami kortelė paspaudus ant bet kurio taško: debesuotumas %, oro temperatūra °C, vėjas m/s, tikslios koordinatės.
   - Tiesioginės navigacijos nuorodos į **Google Maps** ir **Waze**.

2. **Rasti artimiausią saulę ("Find Nearest Sun")**:
   - Vieno paspaudimo mygtukas, kuris pagal jūsų buvimo vietą (GPS) apskaičiuoja artimiausią saulėtą vietą Lietuvoje, atstumą kilometrais bei apytikslį važiavimo laiką automobiliu.

3. **Laiko prognozės slankiklis (Timeline)**:
   - Stebėkite saulės judėjimą ir debesuotumą: **Dabar (Gyvai)**, **+1 val.**, **+2 val.**, **+3 val.**, **+6 val.**, **+12 val.**, **Rytoj**.

4. **Saulėčiausių vietų lyderių sąrašas**:
   - Šoninis stalčius su išrikiuotomis giedriausiomis Lietuvos vietomis.
   - Filtrai: Tik visiškai giedra ✨, Visi saulėti ☀️, Visos stotys 🌐.

5. **Lietuvos vietovių paieška**:
   - Greita paieška tarp visų 2 444 Lietuvos miestų, miestelių ir kaimų.

6. **Dvikalbystė**:
   - Lietuvių kalba (LT) ir Anglų kalba (EN).

---

## 🛠️ Technologijų Rinkinys

- **Serveris (Backend)**:
  - Node.js & Express (TypeScript / ESM)
  - `meteo.lt` (LHMT) API integracija su atmintine (in-memory cache, 8 min. TTL)
  - Geodeziniai atstumų skaičiavimai (Haversine formulė)
  - Port: `3001`
- **Klientas (Frontend)**:
  - React 19, Vite, TypeScript
  - Tailwind CSS v4
  - Leaflet & React-Leaflet
  - Lucide React piktogramos
  - Port: `5173`

---

## 🏃 Paleidimas

### Vienu metu paleisti ir serverį, ir klientą:
```bash
npm run dev
```

Aplikacija atsidarys naršyklėje: **http://localhost:5173**
Backend API pasiekiamas: **http://localhost:3001**

### Paleisti atskirai:
```bash
# Serveris:
cd server
npm run dev

# Klientas:
cd client
npm run dev
```

---

## 📡 API Galiniai Taškai (Endpoints)

- `GET /api/sunny-summary`: Grąžina visų stočių santrauką, debesuotumą ir miestų prognozes.
- `GET /api/stations/live`: 52 AMS stočių gyvi stebėjimų duomenys.
- `GET /api/nearest-sun?lat={lat}&lon={lon}`: Apskaičiuoja artimiausią saulėtą vietą nuo nurodytų koordinačių.
- `GET /api/search?q={tekstas}`: Ieško tarp 2 444 Lietuvos gyvenviečių.
- `GET /api/places/forecast/:code`: Konkretaus miesto detali prognozė.
- `GET /api/health`: Sistemos būklės patikra.

---

## Production / Deployment

The server serves **both the API and the built client** from a single port, so one process is the whole app.

```bash
npm run install:all   # install root, server and client dependencies
npm run check         # lint + tests + production build (run this in CI)
npm start             # serves http://localhost:3001 (API + client)
```

Configuration is via environment variables (see `server/.env.example`):

| Variable | Purpose |
|---|---|
| `PORT` / `HOST` | Listen port (default 3001) and bind address |
| `CORS_ORIGIN` | Comma-separated origins allowed to call `/api` cross-origin. Leave empty when the client is served by this server |
| `REFRESH_TOKEN` | Secret for `POST /api/refresh` (header `x-refresh-token`). Endpoint is disabled if unset |
| `TRUST_PROXY` | Number of reverse proxies in front (e.g. `1`), needed for correct per-IP rate limiting |
| `RATE_LIMIT_PER_MINUTE` | Per-IP limit for `/api` (default 120) |
| `CLIENT_DIST` | Override the built client location |

Client build-time options (Vite env vars): `VITE_TILE_URL` and `VITE_TILE_ATTRIBUTION` switch the map tile provider.
The default is OpenStreetMap's public tile server, which is fine for light traffic; use a keyed provider
(MapTiler, Stadia, ...) for heavy public use.

### What is built in
- Daylight-aware logic: a clear sky at night is **not** reported as sunny (solar position is computed per station/place/time).
- Stale-while-revalidate cache, background refresh every 7 minutes, shared in-flight refresh (no empty first response).
- If the upstream weather service is down, the API serves the last good data, or `503` if there is none; the UI shows a retry state.
- Security: helmet (CSP), compression, per-IP rate limiting, input validation, token-protected refresh, generic 500 errors, graceful shutdown.
- Tests: `npm test` (server unit and HTTP endpoint tests with a mocked weather service).
