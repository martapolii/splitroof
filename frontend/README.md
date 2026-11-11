# Frontend

This folder contains the SplitRoof React/JavaScript client and responsive user interface.

## Provisional responsibility

- Sean Gowans — frontend user journeys and components
- Harkaran Singh Dhillon — responsive UI and accessibility checks
- Brianna Dionisio — frontend/QA integration and cross-browser checks

Assignments are provisional and may change after the team confirms availability and skills.

## Planned work

- Registration and login screens
- Household creation/joining
- Expense entry and equal/custom split flows
- Balance, settlement, budget, and dashboard views
- Frontend tests and responsive/accessibility improvements

## Run it locally

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` first (the Firebase values are in the Firebase console, ask Mohammed if you don't have access). The app runs on http://localhost:5173. `npm run build` makes the same build Vercel deploys, in `dist/`.

## Where things go

- `src/pages/` one file per screen. Each one is a placeholder until its story is built
- `src/components/` pieces used on more than one screen, like the header
- `src/api.js` `apiFetch()` for every call to the Express API
- `src/firebase.js` the Firebase app and `auth`
- `src/index.css` global styles and colours
- `vercel.json` sends every URL to the app so pages load directly on the test bed
