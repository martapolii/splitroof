   function db() {
     return require("../config/firebase");
   }

   // Saves the profile under the Firebase uid. Usernames are unique ignoring capitalization.
   async function saveUserProfile({ uid, email, username }) {
     const users = db().collection("users");
     const usernameLower = username.toLowerCase();

     const taken = await users.where("usernameLower", "==", usernameLower).limit(1).get();
     if (!taken.empty && taken.docs[0].id !== uid) {
       return { usernameTaken: true };
     }

     const ref = users.doc(uid);
     const existing = await ref.get();
     const profile = {
       email: email.toLowerCase(),
       username,
       usernameLower,
       currentHouseholdId: existing.exists ? existing.data().currentHouseholdId ?? null : null,
     };
     await ref.set(profile);
     return { profile };
   }

   module.exports = { saveUserProfile };