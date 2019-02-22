const fs = require("fs");

const json = o => JSON.stringify(o, null, 2);
const jsonparse = JSON.parse;
const socksend = (sock, msg) =>
  sock.send(
    json({
      sent: Date.now(),
      payload: msg
    })
  );

function dirExists(dirname) {
  return fs.existsSync(dirname) && fs.statSync(dirname).isDirectory();
}

module.exports = {
  dirExists,
  json,
  jsonparse,
  socksend
};
