// BH1 (#81): works out what each person owes ONE user, from saved expenses.
// Only expenses the user paid for count. An expense paid by someone else is
// never read, so debts between other members cannot show up.
// Money stays in integer cents.
function sharesOwedToUser(userId, expenses) {
  const totals = new Map();

  for (const expense of expenses) {
    if (expense.payerId !== userId || !Array.isArray(expense.shares)) continue;

    for (const share of expense.shares) {
      if (!share || share.userId === userId) continue; // the user's own share is not a debt
      if (!Number.isSafeInteger(share.amountCents) || share.amountCents <= 0) continue;
      totals.set(share.userId, (totals.get(share.userId) || 0) + share.amountCents);
    }
  }

  const owed = [...totals.entries()]
    .map(([owedById, amountCents]) => ({ userId: owedById, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents || a.userId.localeCompare(b.userId));
  const totalCents = owed.reduce((sum, row) => sum + row.amountCents, 0);

  return { owed, totalCents };
}

module.exports = { sharesOwedToUser };