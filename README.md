# @weavy/uikit-web

<img src="https://img.shields.io/badge/Platform-Lit-orange"/> <img src="https://img.shields.io/badge/Language-TypeScript-orange"/>

Web components based UIKit for Weavy. Built as standard custom elements using the Lit platform. Weavy Web components are available both using `html` and `javascript`/`typescript`.

## Installation

```shell
npm install @weavy/uikit-web
```

## Getting started

You need a Weavy server in order to test any of the frontend examples. If you don't have one, you can create one for free after signing up for an account on <a href="https://get.weavy.com">get.weavy.com</a>.

You also need an application with a user system and a token endpoint. See [Weavy Authentication](https://weavy.com/docs) for more info about configuring authentication and single sign-on between your application and Weavy.

> [Weavy docs](https://weavy.com/docs)

### Weavy configuration

To use any block you must first configure Weavy with an `url` and a `tokenUrl` or `tokenFactory`. This can be done using Javascript or HTML. See [UIKit Web Authentication](https://weavy.com/docs/reference/uikit-web/authentication) for more info about configuring authentication.

```js
import { Weavy } from "@weavy/uikit-weavy";

const weavy = new Weavy();
weavy.url = "https://myenvironment.weavy.io";
weavy.tokenUrl = "https://myserver.example/api/token";
```

### Weavy Blocks

To use a weavy block simply create a component in html or javascript.

```html
<wy-messenger></wy-messenger>
```

## Run the components demo in developer mode

The developer mode compiles and starts up a developer server that also provides authentication for a set of test users.

### .env

You must provide an `.env` file with your _WEAVY_URL_ and _WEAVY_APIKEY_ to run the development test server. See the [.env.example](./.env.example) for an example configuration.

```ini
WEAVY_URL="https://mysite.weavy.io"
WEAVY_APIKEY=""
```

### Dev server

Once you have configured you `.env` you can start up the auth server and dev server. The dev server runs in watch mode.

```bash
npm install
npm start
```

You should see a list of available component demos, choose any you like.

## Documentation

There is some Markdown documentation for the api available in the `dist/docs` folder. You can generate it by running `npm run docs`.

There is also a [custom elements manifest](https://github.com/webcomponents/custom-elements-manifest) available in `dist/custom-elements.json`

To learn more about the different components that you can use and how to setup the authentication flow, head over to our [documentation site](https://weavy.com/docs).

## Tests

There are 2 types of tests in uikit-web - unit and end-to-end.

### Unit

The unit tests can be run as

```
npm install
npm run test:unit
```

These tests are standalone and has no dependencies to a Weavy server or other.

### End-to-end

We use [Playwright ](https://playwright.dev/)as a framework for the e2e-tests. To run the tests you need to setup the following:

1. A Weavy server running locally or in Azure (locally is recommended).
2. Configure Weavy with an API-key, and at least 2 users.
3. Configure the uikit-web to be able to run in dev mode as stated [above](#run-the-components-demo-in-developer-mode).

To run the tests: `npm run test:e2e`

#### Remarks

To run a single test or a subset of tests and also be able to inspect the UI step by step, the console log, network etc run `npx playwright test --ui`

The e2e-tests are currently running in both Chromium and Webkit as headless browsers. Firefox is disabled for now due to too many problems with the uikit-web components.

When running the tests on a newly started Weavy server where the cache hasn't been built up yet a number of tests can fail due to db deadlocks. Re-running the tests will usually solve this.

Running the tests using a Weavy server in Azure can be slow, and also lead to flaky tests. You can increase the waiting timeouts in the tests by editing the timeout const that can be found in the top of each test-file.

Settings for the e2e-tests can be found in `playwright.config.ts` Here you can increase the number of parallell workers for the tests to speed them up, edit the overall timeout for the tests, enable firefox etc.
