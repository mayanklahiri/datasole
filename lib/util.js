const json = o => JSON.stringify(o, null, 2);
const jsonparse = JSON.parse;
const socksend = (sock, msg) =>
  sock.send(
    json({
      sent: Date.now(),
      payload: msg
    })
  );

module.exports = {
  json,
  jsonparse,
  socksend
};
