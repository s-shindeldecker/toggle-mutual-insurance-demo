import React from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

const App = () => {
  const [form, setForm] = React.useState({
    state: "CA",
    age: 32,
    riskProxy: 50,
  });
  const [step, setStep] = React.useState("home");
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [checkout, setCheckout] = React.useState({
    fullName: "",
    email: "",
    address: "",
  });
  const [mascotText, setMascotText] = React.useState(
    "Meet ToMu — the Tree Shrew"
  );

  React.useEffect(() => {
    const loadMascotText = async () => {
      try {
        const response = await fetch("/api/flags/client-id");
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!payload?.clientId) {
          return;
        }

        // Client-side LaunchDarkly is for presentation-only flags. Never evaluate decision flags here.
        const client = window.LDClient?.initialize(payload.clientId, {
          kind: "user",
          key: "ui_home",
        });
        if (!client) {
          return;
        }

        await client.waitUntilReady();
        const value = client.variation(
          "mascot-text-box",
          "Meet ToMu — the Tree Shrew"
        );
        setMascotText(value);
      } catch (error) {
        // Keep default text on failure.
      }
    };

    loadMascotText();
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Unable to fetch quote.");
      }

      const payload = await response.json();
      setResult(payload.quote);
      setStep("summary");
    } catch (err) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const updateCheckout = (event) => {
    const { name, value } = event.target;
    setCheckout((prev) => ({ ...prev, [name]: value }));
  };

  const startOver = () => {
    setStep("input");
    setResult(null);
    setError("");
  };

  const offer = result?.offer;
  const offerPrice = offer ? `$${offer.price.toFixed(2)} / mo` : "—";
  const coverageTier = offer?.coverageTier || "No offer";
  const decision = result?.decisionSummary;
  const guardrails = decision?.guardrails;

  const Stepper = () => html`
    <div className="stepper">
      <span className=${step === "input" ? "active" : ""}>1. Quote</span>
      <span>→</span>
      <span className=${step === "summary" ? "active" : ""}>2. Summary</span>
      <span>→</span>
      <span className=${step === "checkout" ? "active" : ""}>3. Checkout</span>
      <span>→</span>
      <span className=${step === "confirmation" ? "active" : ""}>4. Confirm</span>
    </div>
  `;

  return html`
    <div className="grid">
      ${step !== "home" && html`<${Stepper} />`}

      ${step === "home" &&
      html`
        <div className="card hero">
          <div>
            <h2>Fast, transparent insurance quotes</h2>
            <p className="muted">
              Toggle Mutual helps you understand coverage decisions before you
              commit.
            </p>
            <div className="actions">
              <button type="button" onClick=${() => setStep("input")}>
                Get a quote
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src="/assets/Friendly_tree_shrew_in_a_hoodie-30859d22-2387-4192-9f52-b81b25dc68f1.png"
              alt="ToMu Tree Shrew mascot"
            />
            <p className="muted">${mascotText}</p>
          </div>
          <div>
            <h3>How it works</h3>
            <ul className="how-it-works">
              <li>Share a few details about you and your vehicle.</li>
              <li>We evaluate eligibility, guardrails, and strategy.</li>
              <li>Review your quote and complete checkout.</li>
            </ul>
          </div>
        </div>
      `}

      ${step === "input" &&
      html`
        <div className="card">
          <h2>Get your quote</h2>
          <p className="muted">Provide a few details to generate an instant quote.</p>
          <form onSubmit=${submit}>
            <div className="grid two">
              <label>
                State
                <input
                  name="state"
                  value=${form.state}
                  onInput=${updateField}
                  placeholder="CA"
                />
              </label>
              <label>
                Age
                <input
                  name="age"
                  type="number"
                  min="16"
                  max="100"
                  value=${form.age}
                  onInput=${updateField}
                />
              </label>
              <label>
                Risk Proxy (0-100)
                <input
                  name="riskProxy"
                  type="number"
                  min="0"
                  max="100"
                  value=${form.riskProxy}
                  onInput=${updateField}
                />
              </label>
            </div>
            <div className="actions">
              <button type="submit" disabled=${loading}>
                ${loading ? "Running..." : "Get quote"}
              </button>
            </div>
          </form>
          ${error &&
          html`<p className="muted" style=${{ color: "#b91c1c" }}>${error}</p>`}
        </div>
      `}

      ${step === "summary" &&
      result &&
      html`
        <div className="card grid">
          <div className="offer-card">
            <span className="badge">Your quote</span>
            <div className="offer-price">${offerPrice}</div>
            <div>${coverageTier} coverage</div>
            ${!offer &&
            html`<p className="muted">No offer available for this quote.</p>`}
          </div>

          <div className="grid two">
            <div>
              <h3>Eligibility & guardrails</h3>
              <p className="muted">
                ${decision?.eligibility?.eligible
                  ? "Eligible for an instant quote."
                  : "Ineligible for instant quote."}
              </p>
              <p className="muted">
                Reasons: ${decision?.eligibility?.reasons?.join(", ") || "None"}
              </p>
              <p className="muted">
                Guardrails applied: ${guardrails?.applied?.join(", ") || "None"}
              </p>
            </div>
            <div>
              <h3>Strategy selection</h3>
              <p className="muted">
                Strategy: ${decision?.offerStrategy || "baseline"}
              </p>
              <p className="muted">
                Experiment influenced: ${
                  decision?.experimentationInfluenced ? "Yes" : "No"
                }
              </p>
            </div>
          </div>

          <details>
            <summary>Why this quote?</summary>
            <div className="muted" data-context="strategy">
              ToMu explains: the ${decision?.offerStrategy || "baseline"} strategy
              was selected after model evaluation.
            </div>
            <div className="grid two">
              <div>
                <h4>Decision details</h4>
                <p className="muted">
                  Upsell decision: ${
                    decision?.strategyDecision?.decision || "Not applicable"
                  }
                </p>
                <p className="muted">
                  Reason: ${decision?.strategyDecision?.reason || "—"}
                </p>
                <p className="muted">
                  Propensity: ${
                    decision?.strategyDecision?.propensityScore ?? "—"
                  } / threshold ${decision?.strategyDecision?.propensityThreshold ?? "—"}
                </p>
              </div>
              <div>
                <h4>Model outputs</h4>
                <p className="muted">
                  Risk score: ${result.modelOutputs?.riskScore ?? "—"}
                </p>
                <p className="muted">
                  Price factor: ${result.modelOutputs?.priceFactor ?? "—"}
                </p>
                <p className="muted">
                  Propensity score: ${result.modelOutputs?.propensityScore ?? "—"}
                </p>
              </div>
            </div>
          </details>

          <div className="actions">
            <button
              className="secondary"
              type="button"
              onClick=${() => setStep("checkout")}
              disabled=${!offer}
            >
              Continue to checkout
            </button>
            <button className="ghost" type="button" onClick=${startOver}>
              Start over
            </button>
          </div>
        </div>
      `}

      ${step === "checkout" &&
      result &&
      html`
        <div className="card grid">
          <h2>Checkout</h2>
          <p className="muted">
            Collect customer details for the policy. No payment is processed.
          </p>
          <form>
            <div className="grid two">
              <label>
                Full name
                <input
                  name="fullName"
                  value=${checkout.fullName}
                  onInput=${updateCheckout}
                  placeholder="Avery Johnson"
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  value=${checkout.email}
                  onInput=${updateCheckout}
                  placeholder="avery@email.com"
                />
              </label>
              <label>
                Address
                <input
                  name="address"
                  value=${checkout.address}
                  onInput=${updateCheckout}
                  placeholder="123 Market St"
                />
              </label>
            </div>
          </form>
          <div className="offer-card">
            <div className="offer-price">${offerPrice}</div>
            <div>${coverageTier} coverage</div>
          </div>
          <div className="actions">
            <button type="button" onClick=${() => setStep("confirmation")}>
              Confirm policy
            </button>
            <button className="ghost" type="button" onClick=${startOver}>
              Start over
            </button>
          </div>
        </div>
      `}

      ${step === "confirmation" &&
      result &&
      html`
        <div className="card grid">
          <h2>You're covered 🎉</h2>
          <p className="muted">
            We received your information and have reserved your policy.
          </p>
          <div className="offer-card">
            <div className="offer-price">${offerPrice}</div>
            <div>${coverageTier} coverage</div>
          </div>
          <div className="actions">
            <button className="secondary" type="button" onClick=${startOver}>
              Start a new quote
            </button>
          </div>
        </div>
      `}
    </div>
  `;
};

const root = createRoot(document.getElementById("app"));
root.render(html`<${App} />`);
