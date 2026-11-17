const crypto = require("crypto");
const express = require("express");
const { requireAuth } = require("../middleware/auth");

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

async function uniqueInviteCode() {
  let code = inviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await db().collection("households").where("inviteCode", "==", code).limit(1).get();
    if (taken.empty) return code;
    code = inviteCode();
  }
  return code;
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

// Creating another household does not remove the user from households they already belong to.
async function createHousehold(req, res, next) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ error: "Household name is required" });
    }

    const ref = db().collection("households").doc();
    const household = {
      name,
      adminId: req.user.uid,
      memberIds: [req.user.uid],
      inviteCode: await uniqueInviteCode(),
    };
    await ref.set(household);
    await db().collection("users").doc(req.user.uid).set(
      { currentHouseholdId: ref.id },
      { merge: true }
    );
    return res.status(201).json(householdBody(ref.id, household));
  } catch (err) {
    return next(err);
  }
}

router.post("/", requireAuth, createHousehold);

module.exports = router;
