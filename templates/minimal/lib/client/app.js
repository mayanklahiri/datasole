/**
 * Client-side (browser) application entry point.
 */
import "./styles/global.scss";
import DatasoleClient from "datasole-client";

const PRODUCTION = CONFIG.mode === "production"; // CONFIG is injected by Webpack at build time

function main() {
  if (!PRODUCTION) {
    console.warn("Running in development mode.");
  }
  const datasoleClient = new DatasoleClient();
  datasoleClient.on("update", () => {
    const modelJson = JSON.stringify(datasoleClient.getModel(), null, 2);
    document.getElementById("data-console").textContent = modelJson;
  });

  // Initiate connection.
  datasoleClient.connect();
}

// Enable Webpack HMR in development mode.
if (module.hot && !PRODUCTION) {
  module.hot.accept();
}

main();
