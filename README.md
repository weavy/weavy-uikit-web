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

The developer mode compiles and starts up a developer server that also provides authentication for a single _developer_ user.

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
