# AGENTS.md

## Agent Operating Guide for `/apps/mobile`

This document provides detailed instructions and project conventions for agentic coding agents working in this codebase.

---

## 1. Build, Lint, Format, and (Lack of) Test Commands

### 1.1. Core Scripts (from `package.json`)

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run start`   | Launch Metro/expo dev server (hot reload)   |
| `npm run android` | Run Expo project on Android emulator/device |
| `npm run ios`     | Run Expo project on iOS simulator/device    |
| `npm run web`     | Start Expo project for web browser          |
| `npm run lint`    | Check lint (ESLint & Prettier check)        |
| `npm run format`  | Auto-fix lint & Prettier format all code    |

- Note: There is **no explicit test suite** or test framework configured yet. Add tests as needed following community standards (see section 6).
- There is **no current jest/enzyme/testing-library config** and no test scripts defined.

### 1.2. Running Lint and Format

- **Lint check:**
  ```sh
  npm run lint
  ```
- **Auto-fix + format:**
  ```sh
  npm run format
  ```

### 1.3. Build/run

- **Android:**
  ```sh
  npm run android
  ```
- **iOS:**
  ```sh
  npm run ios
  ```
- **Web:**
  ```sh
  npm run web
  ```

---

## 2. Code Style Guidelines

### 2.1. Formatting Rules ([Prettier](./prettier.config.js))

- **Print width:** 100 characters
- **Tab width:** 2 spaces
- **Quote style:** single
- **Trailing commas:** es5
- **Bracket Position:** brackets on same line
- **Tailwind plugin attributes:** [`className`]
- Always use Prettier for code formatting: `npm run format`

### 2.2. Linting Rules ([eslint.config.js](./eslint.config.js))

- Uses Expo’s broad defaults plus local tweaks
- Ignores: `dist/*`
- Disables: `react/display-name`

### 2.3. Imports

- Use **absolute imports** for modules (use `babel`/`expo` path aliasing if available).
- Prefer **TypeScript imports** (i.e. `.ts`, `.tsx`).
- **Group imports:**
  - Libraries first, then absolute app modules, then relative paths.
  - Style: No unused imports, remove dead code.
- Example:
  ```ts
  import React from 'react';
  import { Button } from 'react-native';
  import { something } from 'utils/foo';
  import MyComponent from './MyComponent';
  ```

### 2.4. File & Naming Conventions

- Filenames: `camelCase` or `PascalCase` with extensions `.ts`/`.tsx`
- React Components: `PascalCase`
- Variables/functions: `camelCase`
- Types/interfaces: `PascalCase` prefixed with `I` only for interfaces (optional)
- Constants: `UPPER_SNAKE_CASE` for exported values, `camelCase` otherwise

### 2.5. Typing & TypeScript

- Always **explicitly type** function params and return values unless trivially inferred
- Use `string | null`, etc., instead of `any`/`unknown` where possible
- Hooks: strongly type state & return types using TS features
- Prefer interfaces for clear object shapes

### 2.6. React & Hooks

- Use **function components** with ES6 arrow syntax or standard function syntax
- Always use hooks for state/lifecycle/data fetching
- Export only one component per file unless tightly coupled
- Use theming/context API for colors/styles (see tailwind.config.js for semantic tokens)

### 2.7. Error Handling

- Use `try/catch` for async/side-effectful operations including network, storage, etc.
- Log errors with `console.error` (use descriptive messages)
  ```ts
  try {
    // ...
  } catch (e) {
    console.error('Useful error message', e);
  }
  ```
- Avoid silent failures; propagate or handle errors thoughtfully
- When unsure, prefer failing early with helpful logs

### 2.8. Styling

- Use **Tailwind CSS** (via nativewind) for component styles
- Reference semantic color and font variables (see [tailwind.config.js](./tailwind.config.js)).
- Do not hardcode colors/fonts where possible
- Use the `className` prop for styling in React Native with nativewind
- Dark mode: Supported via Tailwind dark classes or via environment config

---

## 3. Project Structure

- `/app/` → Route/feature files (Expo Router)
- `/components/` → Reusable UI components
- `/hooks/` → Shared React/TS hooks
- `index.tsx`, `App.tsx` → Entry points
- `/utils/` → Utility modules/functions
- `/theme.ts` → Theming/statics

---

## 4. Commit and PR Guidance

- Commit, PR messages should be present tense, imperative, precise
- Follow conventional commit style if possible (e.g. `feat: add dark mode switch`)
- Do not commit `.env` or secrets
- Write PR summaries describing why, not just what changed

---

## 5. Agent-Specific Instructions

- If a Copilot, Cursor, or AGENTS.md rule file is later added, incorporate it into this doc
- Prefer code actions that are **minimally invasive**
- Prioritize clarity, deterministic builds, and testability/future test extensibility
- If you add test infra (e.g. Jest, Testing Library), update this doc with new commands/guides
- Always run `npm run lint` and `npm run format` before submitting code
- If a build or linter fails, fix before moving forward
- Document newly added or changed conventions directly in this file

---

## 6. Adding Tests (When Needed)

When adding tests to the project:

- Preferred: [Jest](https://jestjs.io/) + [@testing-library/react-native](https://testing-library.com/docs/react-native-testing-library/intro/)
- Locate or create `__tests__/` directories next to the code under test
- Test file names: `foo.test.ts`/`foo.test.tsx`
- Example test script (add to package.json):
  ```json
  "test": "jest"
  ```
- Example test invocation:
  ```sh
  npm run test path/to/foo.test.ts
  ```
- Add more test guidance as the suite is expanded

---

## 7. Inspiration for Agents

- Be proactive in keeping this document up-to-date as standards evolve
- Help coders onboard by surfacing this file when unexplained code issues arise

---

_Last updated: 2026-02-27_
