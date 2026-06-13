# Nuclear Escalation Simulator

> **Educational simulation — simplified public-data heuristics. Not operational, predictive, or prescriptive.**

Nuclear Escalation Simulator is a browser-based React app that visualizes a simplified escalation timeline on a flat 2D world map. It uses persistent trajectory fans, city-level target lists, named missile systems, and transparent blast/casualty heuristics to show how retaliation chains can expand humanitarian harm very quickly.

## Prerequisites

Install **Node.js** from [nodejs.org](https://nodejs.org/), then confirm:

```bash
node -v
npm -v
```

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173)

## Build for production

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## What the simulator models

- A **2D-only pannable/zoomable world map** with persistent launch fans and impact blooms.
- **City-level targeting** using simplified capital-first and population-priority lists.
- A **simplified educational alignment model**:
  - West = US, UK, France, Germany, Italy, Poland, Turkey, Israel, Japan, South Korea
  - East = Russia, Belarus, China, North Korea
  - India and Pakistan remain regional unless directly selected
- **Named delivery systems** in the event log and strike readouts, including ICBM and SLBM examples.
- **Blast radius scaling** based on public-domain cube-root scaling heuristics.

## Data and logic

- `src/data/countries.json` stores country centroids and high-level population figures used for scenario selection and launch origins.
- `src/data/cityProfiles.ts` stores city targets, populations, simplified densities, alignments, and weapon metadata.
- `src/engine/escalationEngine.ts` builds the deterministic launch/impact timeline and bloc escalation waves.
- `src/engine/casualtyModel.ts` calculates blast rings and heuristic casualties from public-domain scaling-law approximations.
- `public/world-countries.geojson` stores the local border dataset for the 2D map.

## Editing the educational model

- Update `src/data/cityProfiles.ts` to change city lists, simplified alignments, or named delivery systems.
- Update `src/data/arsenals.json` to change public stockpile estimates.
- Update `src/engine/escalationEngine.ts` to tune escalation wave sizes or targeting priorities.

The model is intentionally simplified for education and should not be treated as forecasting or operational guidance.
