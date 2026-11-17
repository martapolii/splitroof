// Seans Dashboard Code
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { HouseholdAPI } from '../api.js';
import { DEFAULT_CATEGORIES } from '../categories.js';
import { CATEGORY_COLORS, formatMoney, getExpenseShares, getOwedToUsers, roundMoney } from '../utils/expenseUtils.js';
import './Dashboard.css';

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CATEGORY_COLOR = {
  Rent: '#23a6d5',
  Utilities: '#ee7752',
  Groceries: '#e73c7e',
  Household: '#23d5ab',
  Entertainment: '#d4df38',
  Other: '#808080',
};

const byHighestValue = (left, right) => (right.value || 0) - (left.value || 0);

const dollars = (cents) => roundMoney((Number(cents) || 0) / 100);

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const memberName = (members, uid) => {
  const member = members.find((item) => item.uid === uid);
  return member?.username || member?.uid || uid || '';
};

// The charts still speak in dollars and names. Firestore stores cents and user ids.
const toChartData = (data) => {
  const month = currentMonth();
  const members = Array.isArray(data.members) ? data.members : [];
  const users = members.map((member) => member.username || member.uid).filter(Boolean);
  const currentUser = memberName(members, data.user?.uid);
  const budgets = Array.isArray(data.budgets) ? data.budgets : [];

  const categories = DEFAULT_CATEGORIES.map((title) => {
    const budget = budgets.find((item) => item.category === title && item.month === month);
    return {
      id: title,
      title,
      color: CATEGORY_COLOR[title] || CATEGORY_COLORS[0],
      budget: dollars(budget?.limitCents),
    };
  });

  const expenses = (data.expenses || []).map((expense) => {
    const payer = memberName(members, expense.payerId);
    const shares = {};
    (expense.shares || []).forEach((share) => {
      const name = memberName(members, share.userId);
      if (!name || name === payer) return;
      shares[name] = dollars(share.amountCents);
    });

    return {
      id: expense.id,
      title: expense.description || '',
      amount: dollars(expense.amountCents),
      paidBy: payer,
      datePaid: expense.date || '',
      categoryId: expense.category || '',
      kind: 'shared',
      splitType: 'value',
      splitWith: [payer, ...Object.keys(shares)].filter(Boolean),
      shares,
      payments: {},
      savedAt: expense.date || '',
    };
  });

  const settlements = (data.settlements || []).map((settlement) => {
    const payer = memberName(members, settlement.payerId);
    const receiver = memberName(members, settlement.receiverId);
    return {
      id: settlement.id,
      title: receiver ? `Payment to ${receiver}` : 'Payment',
      amount: dollars(settlement.amountCents),
      paidBy: payer,
      datePaid: settlement.date || '',
      categoryId: '',
      kind: 'payment',
      splitType: 'value',
      splitWith: [receiver].filter(Boolean),
      shares: receiver ? { [receiver]: dollars(settlement.amountCents) } : {},
      payments: {},
      savedAt: settlement.date || '',
    };
  });

  return {
    hasHousehold: Boolean(data.household),
    categories,
    expenses: [...expenses, ...settlements],
    users,
    currentUser,
    month,
  };
};

const buildRings = (slices, total) => {
  if (!(total > 0)) return [];

  return slices.reduce((list, slice) => {
    const dash = (slice.value / total) * CIRCUMFERENCE;
    const offset = list.length ? list[list.length - 1].offset + list[list.length - 1].dash : 0;
    return [...list, { ...slice, dash, offset }];
  }, []);
};

const DonutChart = ({ slices, total, centerAmount, centerDisplay, centerLabel, heading, label }) => {
  const [filled, setFilled] = useState(false);
  const signature = `${total}:${slices.map((slice) => `${slice.id}:${slice.value}`).join('|')}`;
  const rings = buildRings(slices, total);

  useEffect(() => {
    setFilled(false);
    let innerId = 0;
    const outerId = window.requestAnimationFrame(() => {
      innerId = window.requestAnimationFrame(() => setFilled(true));
    });
    return () => {
      window.cancelAnimationFrame(outerId);
      window.cancelAnimationFrame(innerId);
    };
  }, [signature]);

  return (
    <div className="budget-donut-wrap">
      {heading ? <h3 className="budget-donut-heading">{heading}</h3> : null}
      <div className="budget-donut">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
          <circle
            className="budget-donut-track"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />
          {rings.map((slice) => (
            <circle
              key={slice.id}
              className={`budget-donut-slice ${filled ? 'is-filled' : ''} ${slice.upcoming ? 'is-upcoming' : ''}`}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeDasharray={filled ? `${slice.dash} ${CIRCUMFERENCE - slice.dash}` : `0 ${CIRCUMFERENCE}`}
              strokeDashoffset={filled ? -slice.offset : 0}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            >
              <title>
                {slice.title}{slice.dueLabel ? ` ${slice.dueLabel}` : slice.upcoming ? ' - upcoming' : ''}: {slice.amountLabel || formatMoney(slice.value)}
              </title>
            </circle>
          ))}
        </svg>
        <div className="budget-donut-center">
          <p>{centerDisplay || formatMoney(centerAmount)}</p>
          <span>{centerLabel}</span>
        </div>
      </div>
    </div>
  );
};

const formatBalance = (value) => {
  const amount = roundMoney(value);
  if (amount > 0) return `+${formatMoney(amount)}`;
  if (amount < 0) return `-${formatMoney(Math.abs(amount))}`;
  return formatMoney(0);
};

const HouseholdDashboard = ({
  categories = [],
  expenses = [],
  users = [],
  currentUser = '',
  month = '',
  hasHousehold = false,
}) => {
  const items = categories.map((category) => ({
    id: category.id,
    title: category.title || 'Untitled',
    color: category.color,
    budget: Number(category.budget) || 0,
  }));

  const budgetSlices = items
    .filter((item) => item.budget > 0)
    .map((item) => ({ ...item, value: item.budget }))
    .sort(byHighestValue);
  const budgetLegendItems = [...items].sort((left, right) => (right.budget || 0) - (left.budget || 0));
  const totalBudget = budgetSlices.reduce((sum, item) => sum + item.value, 0);

  const householdSize = Math.max(users.filter(Boolean).length, 1);
  const memberNames = users.filter(Boolean);
  const monthlyTotal = roundMoney(
    items
      .filter((item) => item.budget > 0)
      .reduce((sum, item) => sum + item.budget / householdSize, 0)
  );
  const paidExpenses = expenses.filter((expense) => (
    expense.kind !== 'payment'
    && expense.datePaid
    && (!month || String(expense.datePaid).startsWith(month))
  ));
  const shareOf = (expense) => (
    currentUser ? getExpenseShares(expense, memberNames)[currentUser] || 0 : 0
  );
  const paidForCategory = (categoryId) => roundMoney(
    paidExpenses
      .filter((expense) => expense.categoryId === categoryId)
      .reduce((sum, expense) => sum + shareOf(expense), 0)
  );
  const categorizedPaid = items
    .map((item) => ({ ...item, paid: paidForCategory(item.id) }))
    .filter((item) => item.paid > 0);
  const otherPaid = roundMoney(
    paidExpenses
      .filter((expense) => !items.some((item) => item.id === expense.categoryId))
      .reduce((sum, expense) => sum + shareOf(expense), 0)
  );
  const paidSlices = otherPaid > 0
    ? [...categorizedPaid, { id: 'other', title: 'Other', color: '#808080', paid: otherPaid }]
    : categorizedPaid;
  const paidTotal = roundMoney(paidSlices.reduce((sum, item) => sum + item.paid, 0));
  const remaining = Math.max(roundMoney(monthlyTotal - paidTotal), 0);
  const overShare = monthlyTotal > 0 && paidTotal > monthlyTotal;
  // The expenses ring is the full circle. Spending and balances fill that same amount.
  const ringTotal = totalBudget > 0 ? totalBudget : Math.max(paidTotal, 0);
  const fitToExpenses = (amount, sum) => {
    if (!(ringTotal > 0) || !(sum > ringTotal)) return amount;
    return roundMoney(amount * (ringTotal / sum));
  };
  const monthlySlices = paidSlices
    .map((item) => ({
      id: item.id,
      title: item.title,
      color: item.color,
      value: fitToExpenses(item.paid, paidTotal),
      amountLabel: formatMoney(item.paid),
      paid: item.paid,
    }))
    .sort(byHighestValue);
  const owedMatrix = getOwedToUsers(expenses, users);
  const balanceSlices = users
    .filter((user) => user && user !== currentUser)
    .map((user) => {
      const net = roundMoney((owedMatrix[currentUser]?.[user] || 0) - (owedMatrix[user]?.[currentUser] || 0));
      return {
        id: `balance-${user}`,
        title: user,
        color: net > 0 ? '#32cd32' : '#e73c7e',
        value: Math.abs(net),
        net,
        amountLabel: formatBalance(net),
      };
    })
    .filter((item) => item.value > 0)
    .sort(byHighestValue);
  const balanceTotal = roundMoney(balanceSlices.reduce((sum, item) => sum + item.value, 0));
  const netBalance = roundMoney(balanceSlices.reduce((sum, item) => sum + item.net, 0));
  const balanceRingSlices = balanceSlices.map((item) => ({
    ...item,
    value: fitToExpenses(item.value, balanceTotal),
  }));
  const shellRef = useRef(null);
  const contentRef = useRef(null);
  const heightRef = useRef(null);
  const layoutKey = [
    totalBudget,
    monthlyTotal,
    paidTotal,
    netBalance,
    balanceSlices.map((item) => `${item.id}:${item.net}`).join('|'),
    items.map((item) => `${item.id}:${item.title}:${item.budget}`).join('|'),
  ].join(':');

  useEffect(() => {
    AOS.init();
  }, []);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const content = contentRef.current;
    if (!shell || !content) return undefined;

    const nextHeight = content.offsetHeight;
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (heightRef.current == null || reduceMotion) {
      heightRef.current = nextHeight;
      shell.style.height = '';
      return undefined;
    }

    const fromHeight = shell.offsetHeight || heightRef.current;
    if (fromHeight === nextHeight) {
      heightRef.current = nextHeight;
      return undefined;
    }

    shell.style.height = `${fromHeight}px`;
    shell.getBoundingClientRect();
    shell.style.height = `${nextHeight}px`;
    heightRef.current = nextHeight;

    const handleEnd = (event) => {
      if (event.propertyName !== 'height') return;
      if (shell.style.height === `${nextHeight}px`) {
        shell.style.height = '';
      }
      shell.removeEventListener('transitionend', handleEnd);
    };

    shell.addEventListener('transitionend', handleEnd);
    return () => shell.removeEventListener('transitionend', handleEnd);
  }, [layoutKey]);

  const budgetNote = !hasHousehold
    ? 'Create or join a household to see this chart.'
    : 'Set category budgets to see this chart.';
  const shareNote = !hasHousehold
    ? 'Create or join a household to see your share.'
    : 'Set category budgets to see your share.';
  const balanceNote = !hasHousehold
    ? 'Create or join a household to track balances.'
    : 'Invite someone to your household to track balances.';

  return (
    <div className="App">
      <div className="App-body dashboard">
        <div className="dotted-bg" aria-hidden="true" />
        <div className="container" data-aos="zoom-in-up">
          <section className="household-dashboard-shell" ref={shellRef} aria-label="Household monthly expenses, your monthly share, and balances with other members">
            <div className="household-dashboard flex gap-20" ref={contentRef}>
        <div className="dashboard-chart flex col">
          <DonutChart
            slices={budgetSlices}
            total={totalBudget}
            centerAmount={totalBudget}
            centerLabel="Expenses"
            heading="Household monthly expenses"
            label="Household monthly expenses"
          />

          {totalBudget <= 0 ? (
            <p className="household-note">{budgetNote}</p>
          ) : (
            <ul className="budget-legend">
              {budgetLegendItems.map((item) => (
                <li key={item.id}>
                  <span className="budget-legend-dot" style={{ background: item.color }} />
                  <span className="budget-legend-title">{item.title}</span>
                  <span className="budget-legend-amount">
                    {item.budget ? formatMoney(item.budget) : 'No budget'}
                  </span>
                </li>
              ))}
              <li className="budget-legend-total">
                <span className="budget-legend-title">Expenses</span>
                <span className="budget-legend-amount">{formatMoney(totalBudget)}</span>
              </li>
            </ul>
          )}
        </div>

        <div className="dashboard-chart flex col">
          <DonutChart
            slices={monthlySlices}
            total={ringTotal}
            centerAmount={monthlyTotal}
            centerLabel="Share"
            heading="Your monthly share"
            label="Your monthly share, filled by expenses recorded this month"
          />

          {!monthlyTotal ? (
            <p className="household-note">{shareNote}</p>
          ) : (
            <ul className="budget-legend">
              {monthlySlices.map((item) => (
                <li key={item.id}>
                  <span className="budget-legend-dot" style={{ background: item.color }} />
                  <span className="budget-legend-title">{item.title}</span>
                  <span className="budget-legend-amount">{formatMoney(item.paid)}</span>
                </li>
              ))}
              {remaining > 0 ? (
                <li>
                  <span className="budget-legend-dot remaining" />
                  <span className="budget-legend-title">Remaining</span>
                  <span className="budget-legend-amount">{formatMoney(remaining)}</span>
                </li>
              ) : null}
              <li className="budget-legend-total">
                <span className="budget-legend-title">Paid</span>
                <span className={overShare ? 'budget-legend-amount over-budget' : 'budget-legend-amount'}>
                  {formatMoney(paidTotal)}
                </span>
              </li>
            </ul>
          )}
        </div>

        <div className="dashboard-chart flex col">
          <DonutChart
            slices={balanceRingSlices}
            total={ringTotal > 0 ? ringTotal : balanceTotal}
            centerAmount={netBalance}
            centerDisplay={formatBalance(netBalance)}
            centerLabel="Balances"
            heading="Balances"
            label="Net balance with other household members"
          />

          {users.filter(Boolean).length < 2 ? (
            <p className="household-note">{balanceNote}</p>
          ) : balanceTotal <= 0 ? (
            <p className="household-note">You&apos;re even with everyone right now.</p>
          ) : (
            <ul className="budget-legend">
              {balanceSlices.map((item) => (
                <li key={item.id}>
                  <span className="budget-legend-dot" style={{ background: item.color }} />
                  <span className="budget-legend-title">{item.title}</span>
                  <span className={`budget-legend-amount ${item.net > 0 ? 'positive' : 'negative'}`}>
                    {item.amountLabel}
                  </span>
                </li>
              ))}
              <li className="budget-legend-total">
                <span className="budget-legend-title">Balances</span>
                <span className={netBalance > 0 ? 'budget-legend-amount positive' : netBalance < 0 ? 'budget-legend-amount negative' : 'budget-legend-amount'}>
                  {formatBalance(netBalance)}
                </span>
              </li>
            </ul>
          )}
            </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [chart, setChart] = useState(null);

  useEffect(() => {
    let ignore = false;

    HouseholdAPI.current()
      .then((data) => {
        if (ignore) return;
        setChart(toChartData(data));
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        const unreachable = !error.message || error.message === 'Failed to fetch';
        setMessage(unreachable
          ? 'Could not reach the API at http://localhost:3000. Start the backend, then refresh.'
          : error.message);
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (status === 'loading') {
    return <p className="household-note">Loading household…</p>;
  }

  if (status === 'error') {
    return <p className="info-box error">{message}</p>;
  }

  return (
    <HouseholdDashboard
      categories={chart.categories}
      expenses={chart.expenses}
      users={chart.users}
      currentUser={chart.currentUser}
      month={chart.month}
      hasHousehold={chart.hasHousehold}
    />
  );
}
