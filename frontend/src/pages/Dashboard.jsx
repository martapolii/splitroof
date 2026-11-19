import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { HouseholdAPI } from '../api.js';
import './Dashboard.css';
import Hero from '../components/Hero.jsx';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

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
  const month = currentMonth();
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

const HouseholdDashboard = ({
  expenses = [],
  members = [],
  month = '',
  hasHousehold = false,
  currentUser = '',
}) => {
  const monthExpenses = expenses.filter((expense) => (
    expense.date && (!month || String(expense.date).startsWith(month)) && expense.amount > 0
  ));
  const shareOf = (expense, name) => {
    const listed = (expense.shares || []).find((share) => share.member === name);
    if (listed) return listed.amount;
    const custom = expense.split === 'custom';
    if (!custom && members.length) return roundMoney(expense.amount / members.length);
    return 0;
  };
  const balance = roundMoney(monthExpenses.reduce((sum, expense) => {
    const mine = shareOf(expense, currentUser);
    if (expense.member === currentUser) return sum + (expense.amount - mine);
    return sum - mine;
  }, 0));
  const spendingRows = monthExpenses
    .map((expense) => ({
      id: expense.id || `${expense.member}-${expense.category}-${expense.amount}`,
      member: expense.member,
      category: expense.category,
      title: `${expense.member} / ${expense.category}`,
      value: expense.amount,
      color: CATEGORY_COLOR[expense.category] || '#808080',
    }))
    .sort(byHighestValue);
  const monthTotal = roundMoney(spendingRows.reduce((sum, item) => sum + item.value, 0));
  const spendingSlices = spendingRows.map((item) => ({
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
  const balanceNote = !hasHousehold
    ? 'Create or join a household to see your balance.'
    : 'No expenses recorded this month.';

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
                  total={monthTotal}
                  centerAmount={monthTotal}
                  centerLabel="Spending"
                  heading="Household monthly spending"
                  label="Household spending this month"
                />

                {monthTotal <= 0 ? (
                  <p className="household-note">{spendingNote}</p>
                ) : (
                  <table className="dashboard-report">
                    <caption>Household spending</caption>
                    <colgroup>
                      <col className="member" />
                      <col className="category" />
                      <col className="amount" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Member</th>
                        <th scope="col" className="category">Category</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spendingRows.map((item) => (
                        <tr key={item.id}>
                          <th scope="row">
                            <span className="budget-legend-dot" style={{ background: item.color }} />
                            {item.member}
                          </th>
                          <td className="category">{item.category}</td>
                          <td>{formatMoney(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={2}>Total</th>
                        <td>{formatMoney(monthTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              <div className="dashboard-chart flex">
                <DonutChart
                  slices={balanceSlices}
                  total={monthTotal}
                  centerAmount={balance}
                  centerDisplay={formatBalance(balance)}
                  centerLabel="Balance"
                  heading="Your balance"
                  label="What you owe or are owed after this month's splits"
                />

                {monthTotal <= 0 ? (
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
      .then((data) => {
        if (ignore) return;
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
      members={chart.members}
      month={chart.month}
      hasHousehold={chart.hasHousehold}
      currentUser={chart.currentUser}
    />
  );
}