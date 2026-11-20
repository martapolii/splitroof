const crypto = require("crypto");
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireHouseholdMember } = require("../middleware/household");
const { splitEqualExpense } = require("../services/splitService");

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

// Same six names as frontend/src/categories.js and docs/data-model.md.
const CATEGORIES = ["Rent", "Utilities", "Groceries", "Household", "Entertainment", "Other"];

function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function shareUserId(share) {
  if (typeof share?.userId === "string" && share.userId.trim()) return share.userId.trim();
  if (typeof share?.memberId === "string" && share.memberId.trim()) return share.memberId.trim();
  return "";
}

// Custom shares are calculated before they get here (HM8). This only checks
// they belong to the household and add up to the expense.
function customShares(rawShares, memberIds, amountCents) {
  if (!Array.isArray(rawShares) || rawShares.length === 0) {
    throw httpError(400, "Custom split needs a share for each person");
  }

  const seen = new Set();
  const shares = rawShares.map((share) => {
    const userId = shareUserId(share);
    const cents = share?.amountCents;
    if (!userId || !memberIds.includes(userId)) {
      throw httpError(400, "Every person in the split must belong to this household");
    }
    if (seen.has(userId)) {
      throw httpError(400, "Each person can only appear once in the split");
    }
    seen.add(userId);
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw httpError(400, "Each share must be a whole number of cents");
    }
    return { userId, amountCents: cents };
  });

  const total = shares.reduce((sum, share) => sum + share.amountCents, 0);
  if (total !== amountCents) {
    throw httpError(400, "Shares must add up to the expense amount");
  }
  return shares;
}

function equalShares(amountCents, memberIds, payerId, householdMemberIds) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw httpError(400, "Select at least one member for the split");
  }
  for (const id of memberIds) {
    if (!householdMemberIds.includes(id)) {
      throw httpError(400, "Every person in the split must belong to this household");
    }
  }

  // The split engine labels people memberId. Firestore stores userId.
  return splitEqualExpense(amountCents, memberIds, payerId).map((share) => ({
    userId: share.memberId,
    amountCents: share.amountCents,
  }));
}

function expenseFromBody(body, household) {
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const payerId = typeof body?.payerId === "string" ? body.payerId.trim() : "";
  const split = body?.split;
  const amountCents = body?.amountCents;

  if (!category) {
    throw httpError(400, "Category is required");
  }
  if (!CATEGORIES.includes(category)) {
    throw httpError(400, "Category is not one of the approved categories");
  }
  if (!description) {
    throw httpError(400, "Description is required");
  }
  if (!isCalendarDate(date)) {
    throw httpError(400, "Date must be YYYY-MM-DD");
  }
  if (!Number.isSafeInteger(amountCents) || amountCents < 1) {
    throw httpError(400, "Amount must be a whole number of cents greater than zero");
  }
  if (!payerId || !household.memberIds.includes(payerId)) {
    throw httpError(400, "The payer must be a member of this household");
  }
  if (split !== "equal" && split !== "custom") {
    throw httpError(400, "Split must be equal or custom");
  }

  const shares = split === "equal"
    ? equalShares(amountCents, body.memberIds, payerId, household.memberIds)
    : customShares(body.shares, household.memberIds, amountCents);

  return {
    householdId: household.id,
    amountCents,
    description,
    date,
    payerId,
    category,
    split,
    shares,
  };
}

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

// Saves one expense. Equal splits are calculated with the split engine.
// Custom splits keep the shares HM8 already calculated.
async function createExpense(req, res, next) {
  try {
    const expense = expenseFromBody(req.body, req.household);
    const ref = db().collection("expenses").doc();
    await ref.set(expense);
    return res.status(201).json({ id: ref.id, ...expense });
  } catch (err) {
    return next(err);
  }
}

router.post("/", createHousehold);
router.post("/join", joinHousehold);
router.get("/:householdId", requireHouseholdMember, getHousehold);
router.get("/:householdId/members", requireHouseholdMember, getMembers);
router.get("/:householdId/expenses", requireHouseholdMember, getExpenses);
router.post("/:householdId/expenses", requireHouseholdMember, createExpense);

module.exports = router;