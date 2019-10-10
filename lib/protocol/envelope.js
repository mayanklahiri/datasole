const { PROTOCOL_VERSION } = require("./constants");

/**
 * Creates a message envelope with a supplied data object included.
 * @param {object} msgObj Message payload, any JSON-serializable type.
 * @returns {string} Wire-ready string.
 */
function makeMessagePacket(msgObj) {
  // Double-encode the payload so that clients do not have to deserialize
  // message types that they are not interested in.
  return JSON.stringify({
    v: PROTOCOL_VERSION,
    payload: JSON.stringify(msgObj)
  });
}

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
    if (typeof msgPacket !== "object") {
      throw new Error(`expected an object, got "${typeof msgPacket}".`);
    }
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
      return JSON.parse(msgPacket.payload);
    } catch (e) {
      throw new Error(`Cannot decode message payload: ${e}.`, msgPacket);
    }
  }
}

module.exports = {
  parseMessagePacket,
  makeMessagePacket
};
