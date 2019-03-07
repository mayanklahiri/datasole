const PROTOCOL_VERSION = 1;

/**
 * Parse a message envelope (containing a decoder version and a JSON-encoded payload).
 * @param {string} msgData
 * @returns {object} The decoded message payload.
 */
function parseMessagePacket(msgData) {
  // Open message envelope.
  let msgPacket;
  try {
    msgPacket = JSON.parse(msgData);
  } catch (e) {
    throw new Error(`Cannot parse message: ${e}.`);
  }
  if (msgPacket.v !== PROTOCOL_VERSION) {
    throw new Error(
      `Invalid version ${msgPacket.v} on message, expected ${PROTOCOL_VERSION}.`
    );
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

/**
 * Creates a message envelope with a supplied data object included.
 * @param {object} msgObj Message payload, any JSON-serializable type.
 * @returns {string} Wire-ready string.
 */
function makeMessagePacket(msgObj) {
  return JSON.stringify({
    v: PROTOCOL_VERSION,
    payload: JSON.stringify(msgObj)
  });
}

function makeApplyOperation(ops) {
  if (typeof ops !== "object" || !ops.length) {
    throw new Error(`Require a non-empty array.`);
  }
  return {
    type: "apply",
    ops
  };
}

module.exports = {
  parseMessagePacket,
  makeMessagePacket,
  makeApplyOperation
};
