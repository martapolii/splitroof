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

async function currentHouseholdId(uid) {
  const snap = await db().collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return snap.data().currentHouseholdId || null;
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

// No membership check: there is no household to belong to yet.
async function createHousehold(req, res, next) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ error: "Household name is required" });
    }

    const existing = await currentHouseholdId(req.user.uid);
    if (existing) {
      return res.status(409).json({ error: "You already belong to a household" });
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
    await db().collection("users").doc(req.user.uid).set(
      { currentHouseholdId: ref.id },
      { merge: true }
    );
    return res.status(201).json(householdBody(ref.id, household));
  } catch (err) {
    return next(err);
  }
}

// No membership check: the code is what lets a non-member in.
async function joinHousehold(req, res, next) {
  try {
    const inviteCodeValue = typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim() : "";
    if (!inviteCodeValue) {
      return res.status(400).json({ error: "Invite code is required" });
    }

    const found = await db()
      .collection("households")
      .where("inviteCode", "==", inviteCodeValue)
      .limit(1)
      .get();
    if (found.empty) {
      return res.status(404).json({ error: "Invite code is not valid" });
    }

    const doc = found.docs[0];
    const household = doc.data();
    const memberIds = Array.isArray(household.memberIds) ? household.memberIds : [];
    if (memberIds.includes(req.user.uid)) {
      return res.json(householdBody(doc.id, { ...household, memberIds }));
    }

    const existing = await currentHouseholdId(req.user.uid);
    if (existing && existing !== doc.id) {
      return res.status(409).json({ error: "You already belong to a household" });
    }
    if (memberIds.length >= 6) {
      return res.status(400).json({ error: "This household is full" });
    }

    const nextMembers = [...memberIds, req.user.uid];
    await db().collection("households").doc(doc.id).update({ memberIds: nextMembers });
    await db().collection("users").doc(req.user.uid).set(
      { currentHouseholdId: doc.id },
      { merge: true }
    );
    return res.json(householdBody(doc.id, { ...household, memberIds: nextMembers }));
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
