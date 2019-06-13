module.exports = {
  BATCH_ONE: [
    {
      ts: Date.now(),
      message: "hi world",
      level: "info",
      caller: "test.js:123",
      loggerName: "sys"
    }
  ],

  BATCH_MANY: [
    {
      ts: Date.now(),
      message: "hi world",
      level: "info",
      caller: "test.js:123",
      loggerName: "sys"
    },
    {
      ts: Date.now() + 10,
      message: "bye world",
      level: "error",
      caller: "test.js:123",
      loggerName: "app"
    },
    {
      ts: Date.now() + 14,
      message: "final message",
      level: "trace",
      caller: "test.js:456",
      loggerName: "app"
    }
  ]
};
