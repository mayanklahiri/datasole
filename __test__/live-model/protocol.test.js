const {
  parseMessagePacket,
  makeMessagePacket
} = require("../../lib/live-model/protocol");

test("parse and make are reversible", () => {
  const msgObj = {
    foo: {
      bar: 123
    }
  };
  const msgPacket = makeMessagePacket(msgObj);
  const parsedObj = parseMessagePacket(msgPacket);
  expect(parsedObj).toStrictEqual(msgObj);
});
