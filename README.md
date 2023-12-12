# @weavy/uikit-web

<img src="https://img.shields.io/badge/Platform-Lit-orange"/> <img src="https://img.shields.io/badge/Language-TypeScript-orange"/>

Web components based UI kit for Weavy. Built as standard web components using the Lit platform. Weavy Web components are available both using `html` and `javascript`/`typescript`.


## Installation

```shell
npm install @weavy/uikit-web
```

## Getting started

 You need a Weavy server in order to test any of the frontend examples. If you don't have one, you can create one for free after signing up for an account on <a href="https://get.weavy.com">get.weavy.com</a>.

 You also need an application with a user system and a token endpoint. See [Weavy docs](https://weavy.com/docs) for more info about configuring authentication and single sign-on between your application and Weavy.


The Weavy UI components that you decide to use must be wrapped in the `<wy-provider>` component. The `WeavyProvider` handles all the common functionality for all the Weavy Web UI components.

### HTML

 ```html
<!DOCTYPE html>
<head>
  <script src="./dist/weavy.js"></script>
</head>
<body>
  <wy-context url="https://mysite.weavy.io" tokenfactory="async (refresh) => '{ACCESS_TOKEN}'">
    <wy-files uid="acme-files"></wy-files>
  </wy-context>
</body>
```

> See [demo/](./demo/) for more usage examples.

### JS/TS

```js
// Make the web components available in HTML/DOM
import "@weavy/uikit-web";
```

***...or..***

```js
// Import the component classes
import { Weavy, WyMessenger } from "@weavy/uikit-web";

const weavy = new Weavy()

weavy.url = "{WEAVY_URL}";
weavy.tokenFactory = async (refresh) => "{ACCESS_TOKEN}";

const messenger = new WyMessenger();
document.body.append(messenger);
```

## Run the components demo in developer mode

The developer mode compiles and starts up a developer server that also provides authentication for a single *developer* user.

### .env

You must provide an `.env` file with your *WEAVY_URL* and *WEAVY_APIKEY* to run the development test server. See the [.env.example](./.env.example) for an example configuration.

```ini
WEAVY_URL="https://mysite.weavy.io"
WEAVY_APIKEY=""
PORT=3001
```

### Dev server

Once you have configured you `.env` you can start up the auth server and dev server. The dev server runs in watch mode.

```bash
npm install
npm start
```

You should see a list of available component demos, choose any you like.

## Documentation

There is some Markdown documentation for the api available in the `dist/docs` folder. You can generate it by running `npm run prepare`. 

There is also a [custom elements manifest](https://github.com/webcomponents/custom-elements-manifest) available in `dist/custom-elements.json`

To learn more about the different components that you can use and how to setup the authentication flow, head over to our [documentation site](https://weavy.com/docs).