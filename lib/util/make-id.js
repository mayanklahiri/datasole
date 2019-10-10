const crypto = require("crypto");

exports.makeId = () => crypto.randomBytes(12).toString("hex");
