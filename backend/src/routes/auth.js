   const express = require("express");
   const { requireAuth } = require("../middleware/auth");
   const { saveProfile } = require("../controllers/authController");

   const router = express.Router();

   router.post("/profile", requireAuth, saveProfile);

   module.exports = router;