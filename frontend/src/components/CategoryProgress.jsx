import "./CategoryProgress.css";

function formatMoney(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function getStatus(percent) {
  if (percent >= 100) return "over";
  if (percent >= 90) return "warning";
  return "ok";
}

export default function CategoryProgress({ category, limit, spent, left }) {
  // No budget set for this category yet.
  if (!limit) {
    return (
      <div className="progress-card">
        <h3>{category}</h3>
        <p>No budget set. Spent so far: {formatMoney(spent || 0)}</p>
      </div>
    );
  }

  const percent = Math.round((spent / limit) * 100);
  const status = getStatus(percent);
  const barWidth = Math.min(percent, 100);

  return (
    <div className={`progress-card ${status}`}>
      <h3>{category}</h3>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={barWidth}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`progress-fill ${status}`} style={{ width: `${barWidth}%` }} />
      </div>

      <p>
        {formatMoney(spent)} spent of {formatMoney(limit)}, {formatMoney(left)} left ({percent}%)
      </p>

      {status === "warning" && (
        <p role="alert" className="warn-text">
          Warning: you have used {percent}% of the {category} budget.
        </p>
      )}
      {status === "over" && (
        <p role="alert" className="over-text">
          Budget reached: you have used {percent}% of the {category} budget.
        </p>
      )}
    </div>
  );
}