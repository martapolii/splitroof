   const { saveUserProfile } = require("../services/userService");

   // Saves the new user's username and email in Firestore after Firebase sign-up (HM2).
   async function saveProfile(req, res, next) {
     try {
       const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
       if (!username) {
         return res.status(400).json({ error: "Username is required" });
       }
       if (username.length > 30) {
         return res.status(400).json({ error: "Username must be 30 characters or fewer" });
       }
       if (!req.user.email) {
         return res.status(400).json({ error: "Account has no email address" });
       }

       const result = await saveUserProfile({
         uid: req.user.uid,
         email: req.user.email,
         username,
       });
       if (result.usernameTaken) {
         return res.status(409).json({ error: "That username is already taken" });
       }
       return res.status(201).json(result.profile);
     } catch (err) {
       return next(err);
     }
   }

   module.exports = { saveProfile };