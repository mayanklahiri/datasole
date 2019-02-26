/**
 * Client-side (i.e., browser) application transpiled using Webpack.
 */

const PRODUCTION = CONFIG.mode === "production"; // CONFIG is injected by Webpack at build time

function main() {
  // Application entry point.
}

// Enable Webpack HMR in development mode.
if (module.hot && !PRODUCTION) {
  module.hot.accept();
}

main();
