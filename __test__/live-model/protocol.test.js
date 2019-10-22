const { parseMessagePacket, makeMessagePacket } = require("../../lib/protocol");

test("parse and make message are reversible", () => {
  const msgObj = {
    foo: {
      bar: 123
    }
  };
  const msgPacket = makeMessagePacket(msgObj);
  const parsedObj = parseMessagePacket(msgPacket);
  expect(parsedObj).toStrictEqual(msgObj);
});
