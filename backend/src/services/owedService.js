const { debtsBetweenMembers } = require("./debtService");

// BH1 (#81): works out what each person still owes ONE user, from saved expenses.
// It uses the same netted debts as GET .../debts (#78), so if two people paid for
// each other only the difference shows and both screens give the same number.
// Debts between other members are left out. Money stays in integer cents.
function sharesOwedToUser(userId, expenses) {
  const owed = debtsBetweenMembers(expenses)
    .filter((debt) => debt.toUserId === userId)
    .map((debt) => ({ userId: debt.fromUserId, amountCents: debt.amountCents }));
  const totalCents = owed.reduce((sum, row) => sum + row.amountCents, 0);

  return { owed, totalCents };
}

module.exports = { sharesOwedToUser };
