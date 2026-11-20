const crypto = require("crypto");
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireHouseholdMember } = require("../middleware/household");
const { runningBalances } = require("../services/balanceService");

const router = express.Router();
// Every household route requires a signed-in user. Putting this here means any
// route added to this file later (like /current) is protected automatically.
router.use(requireAuth);
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

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
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

// No membership check: the code is what lets a non-member in.
// Reads and writes run in one transaction so overlapping joins cannot drop a member.
async function joinHousehold(req, res, next) {
  try {
    const inviteCodeValue = typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim().toUpperCase() : "";
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

// How many expenses the "recent expenses" list returns.
const RECENT_EXPENSE_LIMIT = 50;

// Returns each member's uid and username so the frontend can fill the payer and
// split-member pickers. Email is left out on purpose; the form does not need it.
async function getMembers(req, res, next) {
  try {
    const memberIds = req.household.memberIds;
    const snaps = await Promise.all(
      memberIds.map((uid) => db().collection("users").doc(uid).get())
    );
    const members = snaps.map((snap, index) => ({
      uid: memberIds[index],
      username: snap.exists ? snap.data().username ?? null : null,
    }));
    return res.json(members);
  } catch (err) {
    return next(err);
  }
}

// Returns this household's most recent expenses, newest first.
// We filter by householdId only and sort in code, because asking Firestore to
// filter and sort on different fields needs a composite index set up in the console.
async function getExpenses(req, res, next) {
  try {
    const snap = await db()
      .collection("expenses")
      .where("householdId", "==", req.household.id)
      .get();
    const expenses = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, RECENT_EXPENSE_LIMIT);
    return res.json(expenses);
  } catch (err) {
    return next(err);
  }
}

// Every balance screen reads this. The list is the full household, not the
// recent-expenses page, so an older share still counts.
async function getBalances(req, res, next) {
  try {
    const snap = await db()
      .collection("expenses")
      .where("householdId", "==", req.household.id)
      .get();
    const expenses = snap.docs.map((doc) => doc.data());
    return res.json(runningBalances(req.household.memberIds, expenses));
  } catch (err) {
    return next(err);
  }
}

router.post("/", createHousehold);
router.post("/join", joinHousehold);
router.get("/:householdId", requireHouseholdMember, getHousehold);
router.get("/:householdId/members", requireHouseholdMember, getMembers);
router.get("/:householdId/expenses", requireHouseholdMember, getExpenses);
router.get("/:householdId/balances", requireHouseholdMember, getBalances);

module.exports = router;