# @weavy/uikit-web

<img src="https://img.shields.io/badge/Platform-Lit-orange"/> <img src="https://img.shields.io/badge/Language-TypeScript-orange"/>

The Weavy UIKit as standard web components, built with [Lit](https://lit.dev) and TypeScript. The components (`<wy-messenger>`, `<wy-chat>`, `<wy-feed>`, `<wy-files>`, `<wy-comments>`, `<wy-copilot>`, `<wy-notifications>` and more) connect to a Weavy environment and add chat, feeds, file sharing, comments, notifications and AI agents to any web app. They work from plain HTML as well as from JavaScript/TypeScript, and they are the foundation for the framework packages such as [`@weavy/uikit-react`](https://www.npmjs.com/package/@weavy/uikit-react).

## Installation

```bash
npm install @weavy/uikit-web
```

## Documentation

Guides, concepts and the component reference are maintained on [docs.weavy.com](https://docs.weavy.com):

- [Adding Weavy to your web app](https://docs.weavy.com/guides/javascript) – step-by-step guide: create an environment, configure authentication and add your first component.
- [Adding the Weavy UIKit](https://docs.weavy.com/learn/uikit), [Authentication](https://docs.weavy.com/learn/authentication), [Components](https://docs.weavy.com/learn/components), [Styling](https://docs.weavy.com/learn/styling) and [Localization](https://docs.weavy.com/learn/localization).
- [UIKit reference](https://docs.weavy.com/reference/uikit/) – properties, events and slots for every component.
- [Changelog](https://docs.weavy.com/resources/changelog).

The published package also contains TypeScript definitions, a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) in `dist/custom-elements.json` and a generated markdown API reference in `dist/docs/`.

## Development

The dev server compiles the components in watch mode and serves a set of demo pages, together with a local auth server that signs in test users against your Weavy environment.

1. Copy `.env.example` to `.env` and set `WEAVY_URL` and `WEAVY_APIKEY` for your environment.
2. Install and start:

```bash
npm install
npm start
```

The start page lists the available component demos.

### HTTPS (optional)

The dev server runs on plain HTTP by default. Enable TLS when you need production-like behavior such as HTTP/2, `Secure`/`SameSite=None` cookies for iframe scenarios, or testing from other devices. Export the ASP.NET developer certificate as PEM (`dev/certs/` is ignored by git) and point the `HTTPS_PEM_*` variables in `.env` at the files:

```bash
mkdir dev/certs
dotnet dev-certs https --export-path dev/certs/localhost.pem --format Pem --no-password
```

```ini
HTTPS_PEM_KEY_PATH="dev/certs/localhost.key"
HTTPS_PEM_CERT_PATH="dev/certs/localhost.pem"
```

Restart `npm start` and the dev server serves `https://localhost:5173`. Run `dotnet dev-certs https --trust` once if the certificate is not trusted. With TLS enabled the auth server runs as a standalone HTTP server on port `3001` (override with `WEAVY_AUTH_PORT`).

### Tests

```bash
npm test            # lint, lit-analyzer, type check and unit tests
npm run test:unit   # unit tests only (Web Test Runner in Chromium, Firefox and WebKit)
```

The unit tests in `tests/unit` are standalone and need no Weavy environment.

The end-to-end tests in `tests/e2e` use [Playwright](https://playwright.dev/) and are not part of `npm test`. They start the dev server, so they need a configured `.env` as described above and a Weavy environment with an API key. Run them with `npx playwright test`, or `npx playwright test --ui` to step through a test and inspect the UI, console and network. Browsers, workers and timeouts are configured in `playwright.config.ts`.
