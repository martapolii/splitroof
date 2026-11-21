// Money helpers for the expense form. Amounts are cents because that is what
// the API stores. An equal split is calculated on the server from the people
// selected here. Percent mode exists only in this form, so those percents are
// turned into cent shares before save. Leftover cents go to the payer first.

export function todayDateInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function dollarsToCents(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function readShareCents(value) {
  if (String(value ?? "").trim() === "") return 0;
  return dollarsToCents(value);
}

export function readPercent(value) {
  const text = String(value ?? "").trim();
  if (text === "") return 0;
  if (!/^\d{1,3}$/.test(text)) return null;
  return Number(text);
}

export function sanitizeMoney(value) {
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${whole}.${fraction}`;
}

export function sanitizePercent(value) {
  return String(value).replace(/[^\d]/g, "").slice(0, 3);
}

export function formatCents(cents) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${remainder}`;
}

export function evenPercents(memberIds, payerId) {
  if (!memberIds.length) return [];
  const base = Math.floor(100 / memberIds.length);
  let extra = 100 % memberIds.length;
  const payerFirst = memberIds.includes(payerId)
    ? [payerId, ...memberIds.filter((id) => id !== payerId)]
    : memberIds;
  const bump = new Set();
  for (const id of payerFirst) {
    if (extra <= 0) break;
    bump.add(id);
    extra -= 1;
  }
  return memberIds.map((userId) => ({
    userId,
    percent: base + (bump.has(userId) ? 1 : 0),
  }));
}

export function prefillPercents(memberIds, payerId) {
  return Object.fromEntries(
    evenPercents(memberIds, payerId).map((entry) => [entry.userId, String(entry.percent)])
  );
}

// Turns whole-number percents into cent shares. Leftover cents use the same
// payer-first order as an equal split, so a 50/50 split of an odd total still adds up.
export function percentToCents(amountCents, percents, payerId) {
  const shares = percents.map((entry) => ({
    userId: entry.userId,
    amountCents: Math.floor((amountCents * entry.percent) / 100),
  }));
  let extra = amountCents - shares.reduce((sum, share) => sum + share.amountCents, 0);
  const payer = shares.find((share) => share.userId === payerId);
  const priority = payer ? [payer, ...shares.filter((share) => share !== payer)] : shares;
  for (const share of priority) {
    if (extra <= 0) break;
    share.amountCents += 1;
    extra -= 1;
  }
  return shares;
}
