const { runtime } = require(process.env.DATASOLE_PATH);

// Keep event loop alive.
setInterval(() => {}, 1000);

runtime.sendRaw({
  type: "apply",
  ops: [
    {
      type: "$set",
      keyPath: "somePath",
      value: { foo: 123 }
    }
  ]
});

runtime.registerRpcHandler("foo.function.identity", async (args, meta) => ({
  args,
  meta
}));

runtime.registerRpcHandler("foo.function.exception", async (args, meta) => {
  throw new Error("Exception throw");
});

runtime.signalReady();
