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
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

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
    } catch (err) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return html`
    <div>
      <form onSubmit=${submit}>
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
        <button type="submit" disabled=${loading}>
          ${loading ? "Running..." : "Run Quote Decision"}
        </button>
      </form>

      ${error &&
      html`<p className="muted" style=${{ color: "#b91c1c" }}>${error}</p>`}

      ${result &&
      html`
        <main>
          <section>
            <h3>Eligibility & Guardrails</h3>
            <pre>${JSON.stringify(result.decisionSummary?.eligibility, null, 2)}</pre>
            <pre>${JSON.stringify(result.decisionSummary?.guardrails, null, 2)}</pre>
          </section>
          <section>
            <h3>Experiment Strategy</h3>
            <pre>${JSON.stringify(
              {
                offerStrategy: result.decisionSummary?.offerStrategy,
                experimentationInfluenced:
                  result.decisionSummary?.experimentationInfluenced,
              },
              null,
              2
            )}</pre>
          </section>
          <section>
            <h3>Offer Result</h3>
            <pre>${JSON.stringify(result.offer, null, 2)}</pre>
          </section>
          <section>
            <h3>Model Outputs</h3>
            <pre>${JSON.stringify(result.modelOutputs, null, 2)}</pre>
          </section>
        </main>
      `}
    </div>
  `;
};

const root = createRoot(document.getElementById("app"));
root.render(html`<${App} />`);
