// BH/HA6 (#78): who owes whom, straight from the saved shares.
// For every expense, each person with a share (other than the payer) owes the payer
// that share. Debts between the same two people are netted into one amount, and
// the result lists only the person who still owes. These are the real debts, not
// suggested payments (that is OC2 in Iteration 2). Money stays in integer cents.
// Settlements are not applied here, same as the balance service.
function debtsBetweenMembers(expenses) {
  // Key: the two ids in sorted order. Value: cents the first id owes the second id
  // (negative means the second owes the first).
  const pairs = new Map();

  for (const expense of expenses) {
    if (!expense || typeof expense.payerId !== "string" || !Array.isArray(expense.shares)) continue;

    for (const share of expense.shares) {
      const debtor = share && (share.userId || share.memberId);
      if (typeof debtor !== "string" || !debtor || debtor === expense.payerId) continue;
      if (!Number.isSafeInteger(share.amountCents) || share.amountCents <= 0) continue;

      const first = debtor < expense.payerId ? debtor : expense.payerId;
      const second = debtor < expense.payerId ? expense.payerId : debtor;
      const key = `${first}\u0000${second}`;
      const sign = debtor === first ? 1 : -1;
      const entry = pairs.get(key) || { first, second, cents: 0 };
      entry.cents += sign * share.amountCents;
      pairs.set(key, entry);
    }
  }

  const debts = [];
  for (const { first, second, cents } of pairs.values()) {
    if (cents > 0) debts.push({ fromUserId: first, toUserId: second, amountCents: cents });
    if (cents < 0) debts.push({ fromUserId: second, toUserId: first, amountCents: -cents });
  }

  return debts.sort((a, b) =>
    b.amountCents - a.amountCents ||
    a.fromUserId.localeCompare(b.fromUserId) ||
    a.toUserId.localeCompare(b.toUserId));
}

module.exports = { debtsBetweenMembers };