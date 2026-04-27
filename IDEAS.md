# Ideas

A place to capture feature ideas and concepts for future revisiting.

---

## Multi-stage international races (`/races/`)

**Status:** Concept — not yet started  
**Discussed:** 2026-04-27

### The idea

A new top-level section for major international stage races (Tour de France, Flandern, Giro d'Italia, etc.), showing per-stage weather forecasts at key waypoints — the same experience as the existing Norwegian ritt pages, but tailored for multi-day races.

**Routes:**

```
/races/                  → Landing page — list of supported races
/races/:raceId           → Stage timeline for a race (e.g. /races/tdf-2025)
/races/:raceId/:stageId  → Weather for a single stage (e.g. /races/tdf-2025/stage-1)
```

### Data model

New file `src/data/races.json` — hand-authored, same spirit as `arrangements.json`:

```jsonc
{
  "id": "tdf-2025",
  "name": "Tour de France 2025",
  "short": "TdF",
  "year": 2025,
  "stages": [
    {
      "id": "stage-1",
      "number": 1,
      "name": "Lille → Lille Métropole",
      "date": "2025-07-05",
      "distance": 184,
      "type": "flat",  // flat | hills | mountain | itt | team-tt
      "waypoints": [
        { "label": "Start – Lille", "lat": 50.63, "lon": 3.07, "altitude": 30 },
        // ~5 waypoints: start, KOM/sprint points, finish
      ]
    }
  ]
}
```

### Key decisions

- **~5 waypoints per stage:** start, key cols/sprints, finish — same pattern as Norwegian ritt
- **Forecast only, no historical fallback:** if a stage is outside the 16-day Open-Meteo window, show a "forecast available from [date]" placeholder instead of climate averages
- **No date picker on stage pages:** stage date is fixed
- **Stage data source:** hand-authored from official race websites (e.g. letour.fr) for now; automation deferred
- **Separate from Norwegian ritt listing** — own nav entry and URL namespace

### Reuse

Existing components (`WeatherStrip`, `WeatherCard`, `EventMap`, `ElevationProfile`) and the `useWeather` hook work as-is. The main effort is:

1. Sourcing accurate coordinates for all waypoints (~105 for TdF 21 stages)
2. Three new page components (`RacesPage`, `RaceDetailPage`, `StagePage`)
3. Router + nav additions

### Deferred / future

- Automated stage data fetching from official sources
- Adding Flandern, Giro, Vuelta, etc. (drop-in additions to `races.json`)
- Historical climate context for stages
- Stage profile images from race organisers
