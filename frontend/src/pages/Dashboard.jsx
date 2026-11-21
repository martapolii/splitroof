import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { HouseholdAPI } from '../api.js';
import './Dashboard.css';
import Hero from '../components/Hero.jsx';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const formatMoney = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value || 0);

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CATEGORY_DROP_MS = 280;

// Built from the theme colors in index.css. Red and green stay reserved for balances and errors.
const MEMBER_COLOR = ['#3d6dff', '#00d8ff', '#00e6b8', '#ffe600', '#ff8a00', '#ffb000'];

const CATEGORY_COLOR = {
  Rent: '#00c2f0',
  Utilities: '#ff7a3c',
  Groceries: '#dfff4a',
  Household: '#2ee6c4',
  Entertainment: '#ffc400',
  Other: '#808080',
};

const byHighestValue = (left, right) => (right.value || 0) - (left.value || 0);

const dollars = (cents) => roundMoney((Number(cents) || 0) / 100);

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const asDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const seconds = value.seconds ?? value._seconds;
  if (seconds) return new Date(seconds * 1000).toISOString().slice(0, 10);
  return '';
};

const memberName = (members, uid) => {
  const member = members.find((item) => item.uid === uid || item.id === uid);
  return member?.username || member?.name || member?.uid || uid || '';
};

const amountOf = (item) => {
  if (!item || typeof item !== 'object') return 0;
  if (item.amountCents != null) return dollars(item.amountCents);
  if (item.totalCents != null) return dollars(item.totalCents);
  if (item.spentCents != null) return dollars(item.spentCents);
  if (item.netCents != null) return dollars(item.netCents);
  if (item.balanceCents != null) return dollars(item.balanceCents);
  return roundMoney(item.amount);
};

// Each expense only needs an amount, a category, and the member who paid.
const toChartData = (data = {}) => {
  const month = data.month || currentMonth();
  const members = Array.isArray(data.members) ? data.members : [];
  const expenses = (data.expenses || []).map((expense) => ({
    id: expense.id,
    amount: amountOf(expense),
    category: expense.category || expense.categoryId || 'Other',
    member: memberName(members, expense.payerId) || expense.payerName || 'Other',
    date: asDate(expense.date || expense.datePaid),
    split: expense.split || '',
    shares: (Array.isArray(expense.shares) ? expense.shares : []).map((share) => ({
      member: memberName(members, share.userId || share.uid) || share.username || share.name || '',
      amount: amountOf(share),
    })).filter((share) => share.member),
  }));

  return {
    hasHousehold: Boolean(data.household),
    members: members.map((member) => member.username || member.name || member.uid).filter(Boolean),
    expenses,
    month,
    // dashboard totals come from the backend (#93)
    spent: dollars(data.spentCents),
    balance: dollars(data.balanceCents),
    currentUser: memberName(members, data.user?.uid) || data.user?.username || '',
  };
};

const formatBalance = (value) => {
  const amount = roundMoney(value);
  if (amount > 0) return `+${formatMoney(amount)}`;
  if (amount < 0) return `-${formatMoney(Math.abs(amount))}`;
  return formatMoney(0);
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

const prefersReducedMotion = () => (
  typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

// Keeps category rows mounted long enough for the dropdown to open and close.
const MemberCategories = ({ open, memberId, categories }) => {
  const [present, setPresent] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const presentRef = useRef(false);

  useLayoutEffect(() => {
    if (open) {
      presentRef.current = true;
      setPresent(true);
      if (prefersReducedMotion()) {
        setExpanded(true);
        return undefined;
      }

      setExpanded(false);
      let innerId = 0;
      const outerId = window.requestAnimationFrame(() => {
        innerId = window.requestAnimationFrame(() => setExpanded(true));
      });
      return () => {
        window.cancelAnimationFrame(outerId);
        window.cancelAnimationFrame(innerId);
      };
    }

    setExpanded(false);
    if (!presentRef.current) return undefined;
    if (prefersReducedMotion()) {
      presentRef.current = false;
      setPresent(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      presentRef.current = false;
      setPresent(false);
    }, CATEGORY_DROP_MS);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!present) return null;

  return categories.map((category) => (
    <tr
      className={`category-row${expanded ? ' is-open' : ''}`}
      key={`${memberId}-${category.category}`}
    >
      <th scope="row">
        <span className="category-reveal">
          <span className="budget-legend-dot" style={{ background: category.color }} />
          {category.category}
        </span>
      </th>
      <td>
        <span className="category-reveal">{formatMoney(category.value)}</span>
      </td>
    </tr>
  ));
};

const HouseholdDashboard = ({
  expenses = [],
  month = '',
  spent = 0,
  balance = 0,
  hasHousehold = false,
  currentUser = '',
}) => {
  const monthExpenses = expenses.filter((expense) => (
    expense.date && (!month || String(expense.date).startsWith(month)) && expense.amount > 0
  ));
  const spendingRows = [...monthExpenses.reduce((totals, expense) => {
    const member = expense.member || 'Other';
    const category = expense.category || 'Other';
    const current = totals.get(member) || { value: 0, categories: new Map() };
    current.value = roundMoney(current.value + expense.amount);
    current.categories.set(category, roundMoney((current.categories.get(category) || 0) + expense.amount));
    totals.set(member, current);
    return totals;
  }, new Map())]
    .map(([member, total]) => ({
      member,
      value: total.value,
      categories: [...total.categories.entries()]
        .map(([category, value]) => ({ category, value }))
        .sort(byHighestValue),
    }))
    .sort(byHighestValue)
    .map((item, index) => ({
      id: item.member,
      member: item.member,
      title: item.member,
      value: item.value,
      color: MEMBER_COLOR[index % MEMBER_COLOR.length],
      categories: item.categories.map((category) => ({
        ...category,
        color: CATEGORY_COLOR[category.category] || '#808080',
      })),
    }));
  const [openMember, setOpenMember] = useState('');
  const selectedMember = spendingRows.find((item) => item.id === openMember);
  const chartRows = selectedMember
    ? selectedMember.categories.map((category) => ({
      id: `${selectedMember.id}-${category.category}`,
      title: category.category,
      value: category.value,
      color: category.color,
    }))
    : spendingRows.map((item) => ({
      id: item.id,
      title: item.member,
      value: item.value,
      color: item.color,
    }));
  const monthTotal = roundMoney(spent);
  const chartTotal = selectedMember ? selectedMember.value : monthTotal;
  const ringTotal = chartRows.reduce((sum, item) => roundMoney(sum + item.value), 0) || chartTotal;
  const spendingSlices = (chartRows.length ? chartRows : [{
    id: 'month',
    title: 'This month',
    value: monthTotal,
    color: '#23a6d5',
  }]).map((item) => ({
    ...item,
    amountLabel: formatMoney(item.value),
  }));
  const balanceSlices = balance === 0 ? [] : [{
    id: 'balance',
    title: currentUser || 'You',
    value: Math.abs(balance),
    color: balance > 0 ? '#32cd32' : '#e73c7e',
    amountLabel: formatBalance(balance),
  }];
  const shellRef = useRef(null);
  const contentRef = useRef(null);
  const heightRef = useRef(null);
  const layoutKey = [
    monthTotal,
    balance,
    currentUser,
    openMember,
    spendingRows.map((item) => `${item.id}:${item.value}`).join('|'),
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

  const spendingNote = !hasHousehold
    ? 'Create or join a household to see this chart.'
    : 'No expenses recorded this month.';
  const balanceNote = 'Create or join a household to see your balance.';

  return (
    <div className="App">
      <div className="App-body dashboard">
        <div className="dotted-bg" aria-hidden="true" />
        <div className="container" data-aos="zoom-in-up">

          <Hero
            phrases={['Split the rent', 'Shared bills', 'Fair shares', 'Your dashboard']}
            eyebrow="Dashboard"
            fixedLine="Dashboard"
            label="Dashboard"
            subtext="Household spending and balances, on one dashboard."
            sectionLabel="Dashboard"
          />

          <section className="household-dashboard-shell" ref={shellRef} aria-label="Household monthly spending and your balance">
            <div className="household-dashboard flex gap-20" ref={contentRef}>
              <div className="dashboard-chart flex">
                <DonutChart
                  slices={spendingSlices}
                  total={ringTotal}
                  centerAmount={chartTotal}
                  centerLabel="Spending"
                  heading="Household monthly spending"
                  label="Household spending this month"
                />

                {spendingRows.length === 0 ? (
                  <p className="household-note">{spendingNote}</p>
                ) : (
                  <table className="dashboard-report">
                    <caption>Household spending</caption>
                    <colgroup>
                      <col className="member" />
                      <col className="amount" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Member</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spendingRows.map((item) => {
                        const open = openMember === item.id;
                        return (
                          <Fragment key={item.id}>
                            <tr>
                              <th scope="row">
                                <button
                                  type="button"
                                  className="member-toggle"
                                  aria-expanded={open}
                                  onClick={() => setOpenMember(open ? '' : item.id)}
                                >
                                  <span className="member-chevron" aria-hidden="true" />
                                  <span className="budget-legend-dot" style={{ background: item.color }} />
                                  {item.member}
                                </button>
                              </th>
                              <td>{formatMoney(item.value)}</td>
                            </tr>
                            <MemberCategories
                              open={open}
                              memberId={item.id}
                              categories={item.categories}
                            />
                          </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total</th>
                        <td>{formatMoney(monthTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              <div className="dashboard-chart flex">
                <DonutChart
                  slices={balanceSlices}
                  total={Math.max(monthTotal, Math.abs(balance))}
                  centerAmount={balance}
                  centerDisplay={formatBalance(balance)}
                  centerLabel="Balance"
                  heading="Your balance"
                  label="What you owe or are owed in this household"
                />

                {/* the balance carries over from earlier months, so show it even with no spending this month */}
                {!hasHousehold ? (
                  <p className="household-note">{balanceNote}</p>
                ) : (
                  <table className="dashboard-report">
                    <caption>Your balance</caption>
                    <colgroup>
                      <col className="member" />
                      <col className="amount" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Member</th>
                        <th scope="col">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">
                          <span className="budget-legend-dot" style={{ background: '#23a6d5' }} />
                          {currentUser || 'You'}
                        </th>
                        <td className={balance > 0 ? 'positive' : balance < 0 ? 'negative' : ''}>
                          {formatBalance(balance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
      .then(async (data) => {
        if (ignore) return null;
        const householdId = data?.household?.id;
        if (!householdId) return data;
        const expenses = await HouseholdAPI.expenses(householdId);
        return { ...data, expenses };
      })
      .then((data) => {
        if (ignore || !data) return;
        setChart(toChartData(data));
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        const missing = /\(404\)|not found/i.test(error.message || '');
        if (missing) {
          setChart(toChartData({}));
          setStatus('ready');
          return;
        }
        const unreachable = !error.message || error.message === 'Failed to fetch';
        setMessage(unreachable
          ? 'Could not reach the API. Start the backend, then refresh.'
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
      expenses={chart.expenses}
      month={chart.month}
      spent={chart.spent}
      balance={chart.balance}
      hasHousehold={chart.hasHousehold}
      currentUser={chart.currentUser}
    />
  );
}