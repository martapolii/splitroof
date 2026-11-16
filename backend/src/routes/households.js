const crypto = require("crypto");
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireHouseholdMember } = require("../middleware/household");

const router = express.Router();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function db() {
  return require("../config/firebase");
}

function inviteCode() {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

async function setCurrentHousehold(uid, householdId) {
  await db().collection("users").doc(uid).set(
    { currentHouseholdId: householdId },
    { merge: true }
  );
}

function householdBody(id, data) {
  return {
    id,
    name: data.name,
    adminId: data.adminId,
    memberIds: data.memberIds,
    inviteCode: data.inviteCode,
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// No membership check: belonging to a household does not block creating another.
async function createHousehold(req, res, next) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ error: "Household name is required" });
    }

    let code = inviteCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const taken = await db().collection("households").where("inviteCode", "==", code).limit(1).get();
      if (taken.empty) break;
      code = inviteCode();
    }

    const ref = db().collection("households").doc();
    const household = {
      name,
      adminId: req.user.uid,
      memberIds: [req.user.uid],
      inviteCode: code,
    };
    await ref.set(household);
    await setCurrentHousehold(req.user.uid, ref.id);
    return res.status(201).json(householdBody(ref.id, household));
  } catch (err) {
    return next(err);
  }
}

// No membership check: the code is what lets a non-member in.
// Reads and writes run in one transaction so overlapping joins cannot drop a member.
async function joinHousehold(req, res, next) {
  try {
    const inviteCodeValue = typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim() : "";
    if (!inviteCodeValue) {
      return res.status(400).json({ error: "Invite code is required" });
    }

    const household = await db().runTransaction(async (transaction) => {
      const found = await transaction.get(
        db().collection("households").where("inviteCode", "==", inviteCodeValue).limit(1)
      );
      if (found.empty) {
        throw httpError(404, "Invite code is not valid");
      }

      const doc = found.docs[0];
      const data = doc.data() || {};
      const userRef = db().collection("users").doc(req.user.uid);
      await transaction.get(userRef);

      const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
      if (memberIds.includes(req.user.uid)) {
        transaction.set(userRef, { currentHouseholdId: doc.id }, { merge: true });
        return householdBody(doc.id, { ...data, memberIds });
      }

      if (memberIds.length >= 6) {
        throw httpError(400, "This household is full");
      }

      const nextMembers = [...memberIds, req.user.uid];
      transaction.update(db().collection("households").doc(doc.id), { memberIds: nextMembers });
      transaction.set(userRef, { currentHouseholdId: doc.id }, { merge: true });
      return householdBody(doc.id, { ...data, memberIds: nextMembers });
    });

    return res.json(household);
  } catch (err) {
    return next(err);
  }
}

function getHousehold(req, res) {
  res.json(householdBody(req.household.id, req.household));
}

router.post("/", requireAuth, createHousehold);
router.post("/join", requireAuth, joinHousehold);
router.get("/:householdId", requireAuth, requireHouseholdMember, getHousehold);

module.exports = router;
