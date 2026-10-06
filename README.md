# Rails Between Us

A multiplayer train adventure board game web application built with React, TypeScript, Vite, and Firebase Firestore.

## Getting Started

### Development
```bash
npm run dev
```

### Building & Testing
```bash
npm run build
npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run end-to-end browser tests (Playwright)
npm run test:e2e:ui  # Run Playwright E2E tests with interactive UI mode
npm run lint         # Run Oxlint
```

## E2E Testing Architecture (Playwright)

End-to-end browser tests are located in `e2e/`. They test real browser flows against the built application.

### Running E2E Tests
```bash
npm run test:e2e
```

### Environment Variables & Secrets for CI/Firebase
For live Firebase multiplayer environment tests or deployment in GitHub Actions, supply the following environment variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
