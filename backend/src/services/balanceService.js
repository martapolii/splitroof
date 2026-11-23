function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function shareUserId(share) {
  if (!share || typeof share !== "object") return null;
  if (typeof share.userId === "string" && share.userId) return share.userId;
  if (typeof share.memberId === "string" && share.memberId) return share.memberId;
  return null;
}

function wholeCents(value) {
  return Number.isSafeInteger(value) ? value : null;
}

// One running balance per person, in cents, from saved expense shares.
// Positive means the household owes them. Negative means they owe the household.
// The balance screens (GET .../balances) and the dashboard (GET /current) both use
// this instead of adding up shares themselves. Settlements are not applied here.
function runningBalances(memberIds, expenses) {
  if (!Array.isArray(memberIds)) {
    throw badRequest("Member IDs are required.");
  }
  if (!Array.isArray(expenses)) {
    throw badRequest("Expenses must be a list.");
  }

  const order = [];
  const balances = new Map();

  function ensure(id) {
    if (balances.has(id)) return;
    balances.set(id, 0);
    order.push(id);
  }

  for (const id of memberIds) {
    if (typeof id !== "string" || !id) {
      throw badRequest("Each member must have a non-empty ID.");
    }
    ensure(id);
  }

  for (const expense of expenses) {
    if (!expense || typeof expense !== "object") {
      throw badRequest("Each expense must include a payer and shares.");
    }

    const paid = wholeCents(expense.amountCents);
    if (paid === null || paid < 0) {
      throw badRequest("Each expense amount must be a non-negative whole number of cents.");
    }
    if (typeof expense.payerId !== "string" || !expense.payerId) {
      throw badRequest("Each expense must name who paid.");
    }
    if (!Array.isArray(expense.shares)) {
      throw badRequest("Each expense must include its saved shares.");
    }

    ensure(expense.payerId);
    balances.set(expense.payerId, balances.get(expense.payerId) + paid);

    for (const share of expense.shares) {
      const userId = shareUserId(share);
      const owed = share && wholeCents(share.amountCents);
      if (!userId || owed === null || owed < 0) {
        throw badRequest("Each share must name a member and a non-negative amount in cents.");
      }
      ensure(userId);
      balances.set(userId, balances.get(userId) - owed);
    }
  }

  return order.map((userId) => ({ userId, balanceCents: balances.get(userId) }));
}

module.exports = { runningBalances };
