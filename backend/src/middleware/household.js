// Runs after requireAuth. The caller must already belong to this household.
async function requireHouseholdMember(req, res, next) {
  try {
    const db = require("../config/firebase");
    const snap = await db.collection("households").doc(req.params.householdId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Household not found" });
    }

    const household = snap.data() || {};
    const memberIds = Array.isArray(household.memberIds) ? household.memberIds : [];
    if (!memberIds.includes(req.user.uid)) {
      return res.status(403).json({ error: "You are not a member of this household" });
    }

    req.household = { id: snap.id, ...household, memberIds };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireHouseholdMember };
