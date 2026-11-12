
const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth");

router.get("/test", verifyToken, (req, res) => {
  res.status(200).json({
    message: "Authentication successful",
    uid: req.user.uid
  });
});

module.exports = router;
