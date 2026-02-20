# AGENTS.md

A comprehensive guide for coding agents and human maintainers in this repository. Applies to both JavaScript/TypeScript (React Native) and Rust (native modules), governed as a pnpm monorepo.

---

## 👥 Audience/Scope
This guide is for both automated coding agents (Copilot, Cursor, LLM-based bots, CI) and human contributors. It ensures uniform coding standards, workflow interoperability, and reliable automation across JS/TS & Rust native modules.

---

## 🗂️ Monorepo Layout
- **Root:** pnpm workspace, Node.js v22.20.0 (see `.nvmrc`).
- **apps/mobile/** — React Native mobile app (Expo-managed)
- **packages/react-native-webdav-server/** — JS/TS native module, also contains native Rust code under `rust/`
- **Rust native modules:** `packages/react-native-webdav-server/rust/webdavserver`, `.../rust/httpserver`

---

## 🚀 Build, Lint, & Test Commands

### Workspace-level (run from root)
- **Install dependencies:**
  ```sh
  pnpm install
  ```
- **Start mobile app (dev server):**
  ```sh
  pnpm run mobile:start
  # or, more directly:
  pnpm --filter mobile run start
  ```
- **Run mobile app on Android Emulator/Device:**
  ```sh
  pnpm --filter mobile run android
  ```
- **Build Rust native module (Android/FFI):**
  ```sh
  pnpm run rust:build
  # Underlying calls ubrn tool for Rust/Android build
  ```
- **Clean build artifacts:**
  ```sh
  pnpm run rust:clean
  ```

### JS/TS Native Module (`packages/react-native-webdav-server`)
- **Type checks:**
  ```sh
  pnpm --filter react-native-webdav-server run typecheck
  ```
- **Unit tests (Jest):**
  ```sh
  pnpm --filter react-native-webdav-server run test
  # Single test pattern:
  pnpm --filter react-native-webdav-server run test -- <pattern>
  ```
- **Build (Bob tool):**
  ```sh
  pnpm --filter react-native-webdav-server run prepare
  ```
  
### Rust Native Modules
From either Rust source directory, e.g. `packages/react-native-webdav-server/rust/webdavserver`:
- **Directory:** Always change to the correct Rust module directory before running commands (e.g. `cd packages/react-native-webdav-server/rust/webdavserver`).
- **Build:**
  ```sh
  cargo build
  ```
- **Lint (Clippy):**
  ```sh
  cargo clippy --all-targets --all-features -- -D warnings
  ```
- **Format:**
  ```sh
  cargo fmt --all -- --check
  ```
- **Tests:**
  ```sh
  cargo test
  # Single test:
  cargo test <test_name>
  ```
- **Run a demo/example (e.g., start_server):**
  ```sh
  cargo run --example start_server
  ```
  - Ensure any required data/config files are present (refer to the `data/` or example documentation).
  - If the command fails due to missing files/crates, check the directory or update dependencies via `cargo update`.
  - Example output/usage may differ; consult `examples/start_server.rs` for custom arguments or environment variables.


---

## 🎨 JavaScript/TypeScript Style Guide

- **Formatting:**
  - 2 spaces, LF, UTF-8, trim trailing whitespace, add final newline (see `.editorconfig`).
- **TypeScript:**
  - Always use strict typings (`strict`, `noImplicitReturns`, `noUncheckedIndexedAccess`, etc. are true).
  - Disallow unused locals/params; require explicit typing for function params/returns if not inferrable.
  - Use ES module syntax; alias `react-native-webdav-server` for import paths.
- **Imports:**
  - Prefer ES6 import/export, group built-ins, external, then local imports.
  - Avoid deep/relative paths outside workspace scope.
- **Naming:**
  - camelCase for variables/functions.
  - PascalCase for components, types, and classes.
  - Prefer descriptive, explicit names.
- **Error Handling:**
  - Use try/catch for async/critical code.
  - Never swallow errors silently; prefer rethrow or logging.
  - Use error boundaries in React components as appropriate.
- **Comments:**
  - Use JSDoc/TSDoc for major classes/functions.
  - Mark all TODO/FIXME with context.
- **Testing:**
  - All new features/bugfixes should include matching Jest tests.

---

## 🦀 Rust Style Guide

- **Formatting:**
  - Follow default rustfmt conventions (indent 4 spaces, max line length default, trailing commas, etc.).
  - Reformat using `cargo fmt --all` before commit/PR.
- **Linting:**
  - Address all warnings and clippy lints.
  - Use `-D warnings` for strict code.
- **Naming:**
  - snake_case for variables, functions, files.
  - PascalCase for types, structs, enums.
  - UpperCamelCase for traits.
- **Error Handling:**
  - Prefer returning `Result<T, E>` for fallible APIs.
  - Use `thiserror` for error enums.
  - Avoid `.unwrap()` or `.expect()` except in tests/main quick prototypes.
- **Documentation:**
  - All public items (modules, functions, types) should include Rust doc comments (`///`).
- **FFI:**
  - Isolate unsafe code.
  - Document JS<->Rust boundary behavior.

---

## 🤖 Agent/Automation/Workflow Rules

### Rust webdavserver module auto-validation

- Whenever ANY file is modified in `packages/react-native-webdav-server/rust/webdavserver/` or its subdirectories:
  - Switch working context or shell to this directory.
  - Run the following commands in sequence:
      - `cargo build` (compile check)
      - `cargo test` (tests/coverage)
      - `cargo run` (main binary, if exists)
      - `cargo run --example start_server` (demo, if example present)
  - Before running demo/example, verify existence of required `data/` or config files as needed.
  - Capture and summarize all command outputs, errors, and results for agent/human review.
- Recommended for CI, git hooks, or custom file-watcher scripts—ensure cross-platform compatibility.
- Agents & contributors MUST follow this workflow after each file change to ensure module stability and catch regressions early.
- For troubleshooting, review cargo command logs and update dependencies or configs as necessary if errors occur.


- **Automated agents must:**
  - Make deterministic, atomic file changes.
  - Not edit auto-generated or lock files without explicit instruction.
  - Respect .gitignore and project secrets policy.
  - Follow conventional commits for commit messages.
  - Prefer minimal-diff, small, single-purpose PRs/commits.
  - Add comment blocks in PRs or code for non-obvious automation decisions.
- **Before merge/PR:**
  - All tests, type checks, and linters MUST pass.
  - Ensure diff does not introduce style or config drift; defer to config files for conflicts.
- **Refer to:**
  - `.editorconfig`, each package’s tsconfig.json, package.json scripts, and Rust Cargo.toml.

---

## 🔗 References
- `pnpm-workspace.yaml`: workspace/project structure
- `.editorconfig`: formatting base
- Each package’s `package.json`, `tsconfig.json`: scripts, build/test/lint/typecheck
- Rust modules’ `Cargo.toml`: build/test/lint dependencies
- `CONTRIBUTING.md` in native module: workflow/PR/contributing expectations
- For further agent updates, add automation instructions in `.github` or dedicated automation config (none present as of last update)

---

*End of AGENTS.md – maintain this file in sync with workspace rules and update when major config or process changes occur.*
