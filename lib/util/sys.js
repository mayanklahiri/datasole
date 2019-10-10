const os = require("os");

const HOSTNAME = process.env.VM_HOSTNAME || os.hostname();
const USERNAME = os.userInfo().username;
const PID = process.pid;

module.exports = {
  HOSTNAME,
  USERNAME,
  PID
};
