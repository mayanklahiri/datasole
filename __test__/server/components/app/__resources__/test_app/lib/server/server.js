const { log, runtime } = require(process.env.DATASOLE_PATH);

log.debug("Application started.");

runtime.registerRpcHandler("foo.function.identity", async (args, meta) => ({
  args,
  meta
}));

runtime.registerRpcHandler("foo.function.exception", async (args, meta) => {
  throw new Error("Exception throw");
});

runtime.registerRpcHandler(
  "registerRejectingAuthHandler",
  async (args, meta) => {
    runtime.registerWsAuthHandler(async wsAuthRequest => {
      return runtime.makeWsAuthResponse(wsAuthRequest, 409, {
        error: "Teapot time",
        code: 409
      });
    });
  }
);

runtime.signalReady();
