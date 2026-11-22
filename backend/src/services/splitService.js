function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validateSplitInputs(amountCents, memberIds) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw badRequest("The expense amount must be a non-negative whole number of cents.");
  }
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw badRequest("Select at least one member for the split.");
  }
  const seen = new Set();
  for (const id of memberIds) {
    if (typeof id !== "string" || !id.trim() || seen.has(id)) {
      throw badRequest("Each selected member must have a unique, non-empty ID.");
    }
    seen.add(id);
  }
}

function splitEqualExpense(amountCents, memberIds, payerId) {
  validateSplitInputs(amountCents, memberIds);
  if (typeof payerId !== "string" || !payerId.trim()) {
    throw badRequest("A payer ID is required.");
  }

  const baseCents = Math.floor(amountCents / memberIds.length);
  const shares = memberIds.map((memberId) => ({ memberId, amountCents: baseCents }));
  const extraCents = amountCents % memberIds.length;

  // Give the payer first priority, then use the original selection order.
  const priority = shares.filter((share) => share.memberId !== payerId);
  const payerShare = shares.find((share) => share.memberId === payerId);
  if (payerShare) priority.unshift(payerShare);
  for (const share of priority.slice(0, extraCents)) {
    share.amountCents += 1;
  }
  return shares;
}

function percentageSharesInCents(amountCents, shares, payerId) {
  const totalPercent = shares.reduce((sum, share) => sum + share.percent, 0);
  if (totalPercent !== 100) {
    throw badRequest("Percentages must add up to 100");
  }

  const needsRounding = [];
  let leftover = amountCents;
  const result = shares.map(({ userId, percent }) => {
    // Use an exact product even for large amounts near Number.MAX_SAFE_INTEGER.
    const product = BigInt(amountCents) * BigInt(percent);
    const share = { userId, amountCents: Number(product / 100n) };
    leftover -= share.amountCents;
    if (product % 100n !== 0n) {
      if (userId === payerId) needsRounding.unshift(share);
      else needsRounding.push(share);
    }
    return share;
  });

  // Give fractional shares one cent each, payer first, then in selection order.
  for (const share of needsRounding.slice(0, leftover)) {
    share.amountCents += 1;
  }
  return result;
}

module.exports = { splitEqualExpense, percentageSharesInCents };
