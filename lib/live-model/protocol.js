function parseMessagePacket(msgData) {
  // Open message envelope.
  let msgPacket;
  try {
    msgPacket = JSON.parse(msgData);
  } catch (e) {
    throw new Error(`Cannot parse message: ${e}.`);
  }
  if (msgPacket.v !== 1) {
    throw new Error(`Invalid version ${msgPacket.v} on message.`, msgPacket);
  }

  // Extract message payload.
  if (msgPacket.payload) {
    try {
      msgPacket.payload = JSON.parse(msgPacket.payload);
    } catch (e) {
      throw new Error(`Cannot decode message payload: ${e}.`, msgPacket);
    }
  }

  return msgPacket.payload;
}

function makeMessagePacket(msgObj) {
  return JSON.stringify({
    v: 1,
    payload: JSON.stringify(msgObj)
  });
}

module.exports = {
  parseMessagePacket,
  makeMessagePacket
};
