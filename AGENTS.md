# AGENTS.md

A comprehensive guide for agentic bots (Copilot, Cursor, LLM-based automation) and human maintainers in this repository. Applies to JavaScript/TypeScript projects (React + Vite, pnpm workspace) and agent workflow protocols.

---
## 👥 Audience/Scope
This guide is for automated coding agents and human contributors. It enforces coding standards, build/test protocols, and agent-friendly automation.

---
## 🗂️ Project Layout
- **apps/filemanager/** — React + TypeScript + Vite web application
- **src/** — Main source code (TSX/TS/JS)
- **package.json** — Project scripts & dependencies
- **eslint.config.js** — ESLint/lint rules
- **tsconfig.json** — TypeScript config

---
## 🚀 Build, Lint & Test Commands

### From `apps/filemanager/` directory:
- **Install dependencies:**
  ```sh
  pnpm install
  ```
- **Run dev server (HMR):**
  ```sh
  pnpm dev
  ```
- **Build (production):**
  ```sh
  pnpm build
  ```
- **Lint (ESLint):**
  ```sh
  pnpm lint
  ```
- **Preview build:**
  ```sh
  pnpm preview
  ```
- **Run single test:**
  _This repo does not have tests by default; add testing via [Vitest](https://vitest.dev/) or [Jest](https://jestjs.io/)._
  ```sh
  pnpm test src/components/YourComponent.test.tsx
  # Or: pnpm vitest run src/YourFile.test.ts
  ```

---
## 🎨 Code Style: JavaScript & TypeScript

### Formatting
- Indent: _2 spaces_, LF, UTF-8
- Trim trailing whitespace; end with newline
- Prefer EditorConfig/Prettier for formatting (if present)

### Imports
- Use ES module syntax: `import ... from ...`
- Order imports: built-in, external, then local
- Avoid deep relative or workspace-external paths
- Use named imports; avoid default if possible

### TypeScript
- Use **strict** type checking (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`)
- Explicitly type function params and returns unless trivial
- Prefer interfaces/type aliases; avoid `any` or loose types
- Disallow unused variables/params

### Naming
- **camelCase** for vars/functions
- **PascalCase** for Components, Classes, Types
- Prefer descriptive names; avoid single letters

### Error Handling
- Use try/catch for critical async code
- Do not silently swallow errors: always log/rethrow appropriately
- Use React error boundaries for UI failures
- Add actionable error/log messages

### Comments & Docs
- Use JSDoc/TSDoc for exported functions/types/classes
- All TODO/FIXME must include context and date
- Avoid commented-out code in production

---
## 🧹 ESLint & Linting
- Use recommended JS/TS + React Hooks rules
- For production, expand configuration (see README for `typescript-eslint` type-checked, stylistic rules)
  - Example:
  ```js
  extends: [
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ]
  ```
- Add `eslint-plugin-react-x` and `eslint-plugin-react-dom` for stricter React rules
- Run lint before every commit (consider pre-commit hooks/CI)
- Agents should always auto-fix when safe

---
## 🤖 Agentic/Automation Rules
- Make atomic, minimal, deterministic file changes
- Do not edit lock or auto-generated files unless asked
- Respect `.gitignore` and never expose secrets
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Test new code using provided scripts; must pass lint & typecheck
- Do not push `.env`, secrets, or credential files
- Quickly adapt (cancel/update tasks) with changing requirements
- Document any ambiguous automation decisions with comments in PRs/code

---
## 📋 Testing (Recommended, Prototype)
- Add tests using [Vitest](https://vitest.dev/) or [Jest](https://jestjs.io/)
- Test coverage: components, hooks, utilities, error boundaries
- Example single test file:
  ```sh
  pnpm test src/YourFile.test.tsx
  ```
- Agents must ensure new features/bugfixes include tests
 
---
## 🧩 UI Components

- Prefer using the daisyUI library for UI components to keep styling consistent and speed development; the repository already includes `daisyui` (see `apps/filemanager/package.json`) and the plugin is registered in `apps/filemanager/src/index.css`.
- If a component cannot reasonably use daisyUI (third-party widget, performance constraints, platform limitations), document the exception and request a quick review from a maintainer.
- Refer to the daisyUI documentation: https://daisyui.com/

---
## 🔗 References
- **README.md:** Expanding/configuring lint rules
- [Vite Documentation](https://vitejs.dev/guide/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

*End of AGENTS.md — Maintain and update with project/config changes.*
