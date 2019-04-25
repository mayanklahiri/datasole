# datasole

Datasole, or **data** con**sole**, is a real-time data model server based on Webpack, Express.js, and WebSockets.
It maintains a synchronized, shared data model (arbitrarily nested object) between a server application process and one
or more connected clients via a real-time broadcast protocol. Individual clients can invoke actions on the server, which can mutate
the shared data model. Clients are automatically updated via a JSON-based data protocol over a Websocket.

Datasole works well with frontend frameworks that support reacting to mutations on a shared data model, such as Vue.

Supported:

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

| Environment variable     | Default | Description                                  |
| ------------------------ | ------- | -------------------------------------------- |
| DATASOLE_LOG_OUTPUT_PATH |         | Path to write logs to, or stdout if blank    |
| DATASOLE_LOG_FORMAT      | `text`  | `text` or `json`                             |
| DATASOLE_LOG_LEVEL_SYS   | `info`  | Datasole runtime logging level               |
| DATASOLE_LOG_LEVEL_APP   | `info`  | User application logging level               |
| DATASOLE_LOG_PASSTHROUGH |         | Set if calling Datasole using node.js fork() |
| DISABLE_COLORS           | `false` | Strip ANSI color codes from log messages     |

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

- Do not delete and attempt to regenerate `package-lock.json` until the following [node-sass issue](https://github.com/sass/node-sass/issues/2625) has been resolved. The `package-lock.json` file checked in has force-upgraded versions of `node-tar`.
