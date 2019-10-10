# datasole

[![CircleCI](https://circleci.com/gh/mayanklahiri/datasole.svg?style=svg)](https://circleci.com/gh/mayanklahiri/datasole)
[![Build Status](https://travis-ci.org/mayanklahiri/datasole.svg?branch=master)](https://travis-ci.org/mayanklahiri/datasole)

Datasole, or _data_ con*sole*, is a fast prototyping tool for realtime, full-stack Javascript web applications using Node and any reactive frontend Javascript framework. It works by maintaining a single shared data model (object) between a server process and multiple connected Websocket clients, as well as providing a thin RPC framework from client to server.

Datasole is based on (and abstracts; opinionates): Webpack, Express, and Websockets connections. It works well with frontend frameworks that support reacting to mutations on a shared data model, such as Vue, Angular, and React.

In development mode, Datasole allows full-stack applications to be interactively developed with the following features:

- Hot Module Reloading (HMR) of the client SPA, via Webpack.
- Application server (backend) restart on source file changes.
- Asset bundling using an opinionated Webpack configuration.
- Templating languages: Pug, HTML
- Stylesheet languages: CSS, Sass (SCSS), LessCSS
- Image formats (with optimizer): SVG, GIF, PNG, JPG, ICO
- `.vue` single-file Vue.js components

The `datasole build` command runs the Webpack build in production mode to produce a static web distribution in the `dist` directory by default.

## Install

`npm install -g datasole`

Datasole can also be used as a locally installed library by omitting the `-g` flag.

## Workflow

Each command attempts sensible defaults. Help for each option: `-h` or `--help`

### init

Start a new project by running `datasole init` in an empty directory.

### dev

Start a development webserver: `datasole dev`

### build

Build a production version of the frontend: `datasole build`

### run

Serve a production version of the frontend: `datasole run` (requires `datasole build` first)

## Settings

The following environment variables affect Datasole's behavior. No environment variables are required by default.

See `lib/config/defaults.js` for the full list of environment variables.

**Required variables**, with defaults:

| Environment variable     | Default      | Description                                                  |
| ------------------------ | ------------ | ------------------------------------------------------------ |
| DISABLE_COLORS           | `false`      | Strip ANSI color codes from log messages.                    |
| DATASOLE_API_URL         | `/api/v1`    | URL path to forward to application as REST requests.         |
| DATASOLE_API_TIMEOUT_SEC | `30`         | Maximum number of seconds before timing out an HTTP request. |
| DATASOLE_LISTEN_ADDRESS  | `0.0.0.0`    | Local address to listen on (`0.0.0.0` = all interfaces)      |
| DATASOLE_LOG_FORMAT      | `text`       | `text` or `json`                                             |
| DATASOLE_LOG_LEVEL_APP   | `info`       | Datasole user application logging level.                     |
| DATASOLE_LOG_LEVEL_SYS   | `info`       | Datasole system runtime logging level.                       |
| DATASOLE_MODE            | `production` | Datasole run mode: `development` or `production`             |
| DATASOLE_PORT            | `8000`       | Port to listen on.                                           |
| DATASOLE_STATIC_URL      | `/`          | Path to serve a fallback static distribution at.             |
| DATASOLE_URL_ROOT_PATH   | `/`          | URL prefix for all paths, useful for path-based proxies.     |
| DATASOLE_WEBSOCKET_URL   | `__ws__`     | Relative path to listen for Websocket connections.           |

**Optional variables**, enables specific features if set (default: **not set**):

| Environment variable           | Description                                                          |
| ------------------------------ | -------------------------------------------------------------------- |
| DATASOLE_LOG_OUTPUT_PATH       | Disk path to write logs to, or write to console if blank.            |
| DATASOLE_STATIC_PATH           | Fallback static distribution disk path to attempt before error page. |
| DATASOLE_BUILTIN_TEMPLATE_PATH | Override path containing Pug templates for built-in error pages.     |

### URL Prefixes

All server URLs will be prefixed by `DATASOLE_URL_ROOT_PATH`. This is useful, e.g., behind a reverse proxy like nginx where different path prefixes map to different upstream backend servers, or behind cloud load balancers.

All other paths (e.g., `DATASOLE_API_URL`, `DATASOLE_STATIC_URL`)

### Logging Level

The following logging levels are supported for `DATASOLE_LOG_LEVEL_APP` and `DATASOLE_LOG_LEVEL_SYS`:

- `trace` (most verbose)
- `debug`
- `info`
- `warn`
- `error`
- `fatal` (silent)

### Static Fallback Distribution

If the SPA does not contain a particular URL, Datasole optionally falls back to a static web distribution on disk.

If the `DATASOLE_STATIC_PATH` variable is set, any files at that path will be served as static content.

## Example projects

See the [datasole-examples](https://github.com/mayanklahiri/datasole-examples) repository.

## Package maintainer notes

- Webpack is not in `devDependencies` because recursive devDependencies are not currently installed by npm, and Webpack is required for developing the client and server components of any project. In the future, Webpack and other large dev dependencies can be moved to `devDependencies` by requiring a global npm install of `datasole` for development.

### Source Statistics

| Statistic | Value |
| --- | --- |
| Total lines of code | 4262 |
| Source lines | 3153 (74%) |
| Comment lines | 621 |
| Installed node_modules size | 188M |
---
