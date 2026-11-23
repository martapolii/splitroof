import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import { HouseholdAPI } from "../api.js";
import Hero from "../components/Hero.jsx";
import "./WhoOwesMe.css";

const formatMoney = (cents) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format((Number(cents) || 0) / 100);

// Everyone listed here owes the user, so the amounts are always a plus.
const formatOwed = (cents) => {
  const amount = Number(cents) || 0;
  if (amount > 0) return `+${formatMoney(amount)}`;
  return formatMoney(0);
};

const loadError = (error) => (
  error?.message === "Failed to fetch"
    ? "Could not reach the API. Start the backend, then refresh."
    : error?.message || "Could not load who owes you."
);

async function loadOwed() {
  const current = await HouseholdAPI.current();

  if (current?.household === null) {
    return { kind: "none" };
  }

  if (!current?.household?.id) {
    throw new Error("Could not identify the current household.");
  }

  const owed = await HouseholdAPI.owedToMe(current.household.id);

  return {
    kind: "ready",
    name: current.household.name || "your household",
    balanceCents: current.balanceCents ?? 0,
    owedToMe: Array.isArray(owed?.owedToMe) ? owed.owedToMe : [],
    totalCents: owed?.totalCents ?? 0,
  };
}

export default function WhoOwesMe() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [balanceCents, setBalanceCents] = useState(0);
  const [rows, setRows] = useState([]);
  const [totalCents, setTotalCents] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const apply = (result) => {
    if (result.kind === "none") {
      setStatus("no-household");
      return;
    }

    setHouseholdName(result.name);
    setBalanceCents(result.balanceCents);
    setRows(result.owedToMe);
    setTotalCents(result.totalCents);
    setStatus("ready");
  };

  useEffect(() => {
    AOS.init();
  }, []);

  useEffect(() => {
    let ignore = false;

    loadOwed()
      .then((result) => {
        if (!ignore) apply(result);
      })
      .catch((error) => {
        if (ignore) return;
        setMessage(loadError(error));
        setStatus("error");
      });

    return () => {
      ignore = true;
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    setMessage("");

    try {
      apply(await loadOwed());
    } catch (error) {
      setMessage(loadError(error));
    } finally {
      setRefreshing(false);
    }
  };

  if (status === "loading") {
    return <p className="household-note">Loading who owes you…</p>;
  }

  if (status === "error") {
    return <p className="info-box error">{message}</p>;
  }

  if (status === "no-household") {
    return (
      <section className="container" aria-labelledby="owed-setup-heading">
        <h1 id="owed-setup-heading">Set up your household</h1>
        <p>Create a household or join an existing one using an invite code.</p>
        <Link className="frontend-button" to="/household">
          Create or Join a Household
        </Link>
      </section>
    );
  }

  return (
    <div className="App">
      <div className="App-body owed">
        <div className="dotted-bg" aria-hidden="true" />

        <div className="container" data-aos="zoom-in-up">
          <Hero
            phrases={["Who owes you", "Outstanding balances", "Your running balance"]}
            eyebrow="Who Owes Me"
            fixedLine="Who Owes Me"
            label="Who Owes Me"
            subtext={`Members of ${householdName} who still owe you, and your running balance.`}
            sectionLabel="Who Owes Me"
          />
        </div>

        <div className="container container-2" data-aos="zoom-in-up">
          <section className="owed-panel" aria-labelledby="owed-balance-label">
            <div className="owed-toolbar">
              <dl className="owed-balance">
                <dt id="owed-balance-label">Running balance</dt>
                <dd aria-live="polite" className={balanceCents > 0 ? "positive" : undefined}>
                  {balanceCents < 0 ? `-${formatMoney(Math.abs(balanceCents))}` : formatOwed(balanceCents)}
                </dd>
              </dl>
              <button
                type="button"
                className="frontend-button"
                onClick={refresh}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {message ? <p className="info-box error">{message}</p> : null}

            {rows.length === 0 ? (
              <p className="household-note">Nobody owes you right now.</p>
            ) : null}

            <table className="owed-table">
              <thead>
                <tr>
                  <th scope="col">Members</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <th scope="row">{row.username || row.userId}</th>
                    <td className="positive">{formatOwed(row.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total owed to you</th>
                  <td className="positive">{formatOwed(totalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}