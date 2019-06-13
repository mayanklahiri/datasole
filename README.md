# datasole

[![CircleCI](https://circleci.com/gh/mayanklahiri/datasole.svg?style=svg)](https://circleci.com/gh/mayanklahiri/datasole)

Datasole, or _data_ con*sole*, is a fast prototyping tool for realtime, full-stack Javascript web applications.
Datasole handles the plumbing of keeping a **server** Javascript application in sync with many **client**
Javascript applications, which includes:

- Bundle client application using Webpack.
- Serve client bundle in development (hot module replacement) and production (static build) mode.
- Start and supervise the server application.
- Allow the server application to mutate a shared model, and propagate these mutations to all connected clients.
- Allow clients to trigger RPC-style **actions** in the server application, which can mutate the shared state.

Datasole is based on (and abstracts): Webpack, Express, and WebSockets (via the `ws` library).

Datasole works well with frontend frameworks that support reacting to mutations on a shared data model, such as Vue.

The following features are supported when developing a Datasole application:

- Server application restart on source file changes
- Asset bundling via Webpack, with hot module reloading
- Templating languages: Pug, HTML
- Stylesheet languages: CSS, Sass (SCSS), LessCSS
- Image formats: SVG, GIF, PNG, JPG, ICO
- `.vue` single-file Vue.js components.

## Install

`npm install -g datasole`

Datasole can also be used as a library without `-g`.

## Workflow

Help for each option: `-h` or `--help`

### init

Start a new project by running `datasole init` in an empty directory.

### dev

Start a development webserver: `datasole dev`

### build

Build a production version of the frontend: `datasole build`

### run

Serve a production version of the frontend: `datasole run` (requires `datasole build` first)

## Settings

The following environment variables affect Datasole's behavior.

| Environment variable     | Default | Description                               |
| ------------------------ | ------- | ----------------------------------------- |
| DATASOLE_LOG_OUTPUT_PATH |         | Path to write logs to, or stdout if blank |
| DATASOLE_LOG_FORMAT      | `text`  | `text` or `json`                          |
| DATASOLE_LOG_LEVEL_SYS   | `info`  | Datasole runtime logging level            |
| DATASOLE_LOG_LEVEL_APP   | `info`  | User application logging level            |
| DISABLE_COLORS           | `false` | Strip ANSI color codes from log messages  |

The following logging levels are supported:

- `trace`
- `debug`
- `info`
- `warn`
- `error`

## Example projects

See the [datasole-examples](https://github.com/mayanklahiri/datasole-examples) repository.

## Package maintainer notes

- Webpack is not in `devDependencies` because recursive devDependencies are not currently installed by npm, and Webpack is required for developing the client and server components of any project. In the future, Webpack and other large dev dependencies can be moved to `devDependencies` by requiring a global npm install of `datasole` for development.

### Source Statistics

| Statistic                   | Value      |
| --------------------------- | ---------- |
| Total lines of code         | 3294       |
| Source lines                | 2441 (74%) |
| Comment lines               | 457        |
| Installed node_modules size | 205M       |

---
