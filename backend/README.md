# Backend

This folder contains the SplitRoof Node.js/Express API, business rules, authentication, and Firestore access.

## Provisional responsibility

- Mohammed Aljaroudi — API and authentication
- Fatima Dabbous — Firestore data model and persistence

Assignments are provisional and may change after the team confirms availability and skills.

## Planned work

- User registration and login
- JWT/protected routes and password security
- Household membership and invite codes
- Expenses, equal/custom splits, balances, and settlements
- Budgets, dashboard data, backend tests, and deployment configuration

## Run it locally

```
cd backend
npm install
cp .env.example .env
npm run dev
```

The API runs on http://localhost:3000. Check it with http://localhost:3000/api/health, it should show `{"status":"ok"}`. `npm start` runs it without nodemon, the same way Render does. There's no build step for the backend, Render just runs `npm ci` and then `npm start`.

Right now the API starts without the Firebase values. Once Firestore is loaded in `app.js` (#118) you'll need them in `.env` to start it. `FIREBASE_PRIVATE_KEY` goes in on one line with `\n` where the line breaks are.

## Where things go

- `src/server.js` loads `.env` and starts the server
- `src/app.js` sets up Express, CORS and the routes
- `src/routes/`, `src/controllers/`, `src/services/` one file per area (auth, households, expenses...)
- `src/middleware/auth.js` empty for now, this is where the Firebase ID token check goes (HM1, #108)
- `src/middleware/error.js` 404 and error responses as `{ "error": "message" }`
