require("./firebase");
const { getAuth } = require("firebase-admin/auth");

module.exports = {
  auth() {
    return getAuth();
  },
};
