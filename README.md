# Nuclear Escalation Simulator

> **Educational simulation — simplified heuristic models using public data. Not operational or predictive.**

Nuclear Escalation Simulator is a browser-based React app that visualizes a simplified nuclear escalation timeline on a 3D globe. It is designed to help learners understand how retaliation chains and alliance commitments can rapidly increase humanitarian harm, using transparent public-data heuristics instead of operational or predictive modeling.

## Prerequisites

Before running the project, install **Node.js** from [nodejs.org](https://nodejs.org/).

After installation, verify your setup:

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

3. Open your browser at [http://localhost:5173](http://localhost:5173)

## Build for production

Create an optimized production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy

### Netlify

After running `npm run build`, drag the generated `dist/` folder into the Netlify dashboard to publish the site.

### GitHub Pages

You can also deploy the static `dist/` output to GitHub Pages using any standard static-site workflow, such as uploading the build artifacts in a GitHub Actions workflow.

## How it works

The simulator is fully client-side and uses a few simple data and modeling layers:

- `src/data/countries.json` stores country centroids, population, and population density.
- `src/data/arsenals.json` stores simplified public arsenal estimates from SIPRI/FAS-style sources.
- `src/data/alliances.json` stores a deliberately simplified alliance graph for retaliation chains.
- `src/engine/escalationEngine.ts` builds a deterministic event queue of launches, impacts, and retaliation decisions.
- `src/engine/casualtyModel.ts` uses transparent blast-ring heuristics based on public-domain scaling-law approximations from *The Effects of Nuclear Weapons*.

The casualty estimates are intentionally simplified. They use blast-radius scaling, affected-area calculations, and local population density to create easy-to-follow consequence estimates for education.

## Editing the scenario data

### Update arsenal data

Edit `src/data/arsenals.json` to change public estimate values such as:

- `warheads`
- `deployedWarheads`
- `yields_kt`
- `note`

### Update alliances

Edit `src/data/alliances.json` to add or remove alliance relationships, nuclear members, or simplified bilateral arrangements.

Because the app is static and client-side, any edits to these JSON files are picked up the next time you run `npm run dev` or rebuild with `npm run build`.
