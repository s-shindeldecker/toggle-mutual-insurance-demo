import React from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
};

const presets = [
  {
    id: "urban_commuter",
    label: "Urban commuter",
    data: {
      address: "221 Market St, San Francisco, CA 94105",
      fullName: "Alex Rivera",
      age: 29,
      maritalStatus: "single",
      numberOfKids: 0,
      vehicleYear: 2019,
      vehicleMake: "Honda",
      vehicleModel: "Civic",
      vehicleVin: "1HGCM82633A004352",
      vehicleOdometer: 42000,
      vehicleAnnualMileage: 9000,
    },
  },
  {
    id: "suburban_family",
    label: "Suburban family",
    data: {
      address: "875 Maple Ave, Naperville, IL 60540",
      fullName: "Jordan Lee",
      age: 41,
      maritalStatus: "married",
      numberOfKids: 2,
      vehicleYear: 2017,
      vehicleMake: "Toyota",
      vehicleModel: "Highlander",
      vehicleVin: "5TDDZ3DC7HS123456",
      vehicleOdometer: 68000,
      vehicleAnnualMileage: 12000,
    },
  },
  {
    id: "rural_truck",
    label: "Rural truck owner",
    data: {
      address: "104 County Road 12, Boise, ID 83702",
      fullName: "Taylor Morgan",
      age: 52,
      maritalStatus: "married",
      numberOfKids: 1,
      vehicleYear: 2015,
      vehicleMake: "Ford",
      vehicleModel: "F-150",
      vehicleVin: "1FTEW1EP1FFA12345",
      vehicleOdometer: 92000,
      vehicleAnnualMileage: 15000,
    },
  },
];

const App = () => {
  const [selectedPreset, setSelectedPreset] = React.useState(presets[0].id);
  const [form, setForm] = React.useState(presets[0].data);
  const [step, setStep] = React.useState("home");
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [checkout, setCheckout] = React.useState({
    fullName: "",
    email: "",
    address: "",
  });
  const [confirmationId, setConfirmationId] = React.useState(null);
  const [ldReady, setLdReady] = React.useState(false);
  const [mascotText, setMascotText] = React.useState(null);
  const [demoPanelOpen, setDemoPanelOpen] = React.useState(false);
  const ldClientRef = React.useRef(null);
  const sessionKeyRef = React.useRef(null);
  const userKeyRef = React.useRef(null);

  const getSessionKey = () =>
    getCookie("tm_session_public") || `sess_${Math.random().toString(36).slice(2, 10)}`;
  const generateUserKey = () =>
    `user_${Math.random().toString(36).slice(2, 10)}`;

  const hashString = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 1000000007;
    }
    return `loc_${Math.abs(hash).toString(36)}`;
  };

  const parseAddress = (address) => {
    if (!address) {
      return { street: "", city: "", state: "", zip: "" };
    }
    const match = address.match(/^(.*),\s*([^,]+),\s*([A-Za-z]{2})\s*(\d{5})?$/);
    if (!match) {
      return { street: address, city: "", state: "", zip: "" };
    }
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: match[3].toUpperCase(),
      zip: match[4] || "",
    };
  };

  const buildClientContext = (data, stage) => {
    const sessionContext = {
      kind: "session",
      key: sessionKeyRef.current,
    };

    if (stage === "session") {
      return sessionContext;
    }

    const addressParts = parseAddress(data.address || "");
    const locationKey = data.address ? hashString(data.address) : "loc_unknown";
    const locationContext = {
      key: locationKey,
      address: data.address || "unknown",
      street: addressParts.street,
      city: addressParts.city,
      state: addressParts.state,
      zip: addressParts.zip,
    };

    const context = {
      kind: "multi",
      session: sessionContext,
      location: locationContext,
    };

    if (userKeyRef.current) {
      context.user = {
        key: userKeyRef.current,
        name: data.fullName,
        age: Number(data.age) || 0,
        maritalStatus: data.maritalStatus,
        numberOfKids: Number(data.numberOfKids) || 0,
      };
    }

    if (stage !== "vehicle") {
      return context;
    }

    const vehicleKey = data.vehicleVin
      ? data.vehicleVin
      : `${data.vehicleYear || "unknown"}-${data.vehicleMake || "unknown"}-${
          data.vehicleModel || "unknown"
        }`;
    context.vehicle = {
      key: vehicleKey,
      year: Number(data.vehicleYear) || 0,
      make: data.vehicleMake || "unknown",
      model: data.vehicleModel || "unknown",
      vinProvided: Boolean(data.vehicleVin),
      odometer: Number(data.vehicleOdometer) || 0,
      annualMileage: Number(data.vehicleAnnualMileage) || 0,
    };

    return context;
  };

  const identifyClientContext = (context) => {
    const client = ldClientRef.current;
    if (!client) {
      return;
    }
    client.identify(context);
  };

  const goHome = () => {
    userKeyRef.current = null;
    setSelectedPreset(presets[0].id);
    setForm(presets[0].data);
    setCheckout({ fullName: "", email: "", address: "" });
    setConfirmationId(null);
    setResult(null);
    setError("");
    setStep("home");
  };

  const startNewSession = async () => {
    try {
      const response = await fetch("/api/session/reset", { method: "POST" });
      if (!response.ok) {
        return;
      }
    } catch {
      return;
    }
    sessionKeyRef.current = getSessionKey();
    userKeyRef.current = null;
    setSelectedPreset(presets[0].id);
    setForm(presets[0].data);
    setCheckout({ fullName: "", email: "", address: "" });
    setConfirmationId(null);
    setResult(null);
    setError("");
    setStep("home");
    if (ldReady) {
      identifyClientContext(buildClientContext({}, "session"));
    }
  };

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
        if (!ldClientRef.current) {
          sessionKeyRef.current = getSessionKey();
          const context = buildClientContext(form, "session");
          ldClientRef.current = window.LDClient?.initialize(
            payload.clientId,
            context
          );
        }
        const client = ldClientRef.current;
        if (!client) {
          return;
        }

        await client.waitUntilReady();
        const value = client.variation(
          "mascot-text-box",
          "Meet ToMu — the Tree Shrew"
        );
        setMascotText(value);
        setLdReady(true);
        client.on("change:mascot-text-box", (nextValue) => {
          setMascotText(nextValue);
        });
      } catch (error) {
        // Keep default text on failure.
      }
    };

    loadMascotText();
    return () => {
      if (ldClientRef.current) {
        ldClientRef.current.off("change:mascot-text-box");
      }
    };
  }, []);

  React.useEffect(() => {
    const handleHomeClick = (event) => {
      const target = event.target.closest("#home-logo, #home-link");
      if (!target) {
        return;
      }
      event.preventDefault();
      goHome();
    };

    const handleNewUser = (event) => {
      event.preventDefault();
      startNewSession();
    };

    const handleDemoPanelBtn = () => {
      setDemoPanelOpen((prev) => !prev);
    };

    const handleKeyDown = (event) => {
      if (event.key === "D" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const tag = (event.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") {
          return;
        }
        if (event.target.isContentEditable) {
          return;
        }
        event.preventDefault();
        setDemoPanelOpen((prev) => !prev);
      }
    };

    document.addEventListener("click", handleHomeClick);
    document.addEventListener("keydown", handleKeyDown);
    const newUserBtn = document.getElementById("new-user-btn");
    if (newUserBtn) {
      newUserBtn.addEventListener("click", handleNewUser);
    }
    const demoPanelBtn = document.getElementById("demo-panel-btn");
    if (demoPanelBtn) {
      demoPanelBtn.addEventListener("click", handleDemoPanelBtn);
    }
    return () => {
      document.removeEventListener("click", handleHomeClick);
      document.removeEventListener("keydown", handleKeyDown);
      if (newUserBtn) {
        newUserBtn.removeEventListener("click", handleNewUser);
      }
      if (demoPanelBtn) {
        demoPanelBtn.removeEventListener("click", handleDemoPanelBtn);
      }
    };
  }, [ldReady]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const applyPreset = (event) => {
    const presetId = event.target.value;
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setSelectedPreset(presetId);
    setForm(preset.data);
  };

  const submitQuote = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          userKey: userKeyRef.current,
        }),
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
    setStep("home");
    setResult(null);
    setConfirmationId(null);
    setError("");
  };

  const submitCheckout = async () => {
    setCheckoutLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: checkout.fullName,
          email: checkout.email,
          address: checkout.address,
          quoteId: result?.id || "unknown",
          userKey: userKeyRef.current,
        }),
      });
      if (!response.ok) {
        throw new Error("Checkout failed.");
      }
      const payload = await response.json();
      setConfirmationId(payload.confirmationId);
      setStep("confirmation");
    } catch (err) {
      setError(err.message || "Checkout error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const offer = result?.offer;
  const offerPrice = offer ? `$${offer.price.toFixed(2)} / mo` : "—";
  const coverageTier = offer?.coverageTier || "No offer";
  const decision = result?.decisionSummary;
  const guardrails = decision?.guardrails;
  const riskTier =
    result?.decisionSummary?.riskTier
      ? result.decisionSummary.riskTier[0].toUpperCase() +
        result.decisionSummary.riskTier.slice(1)
      : "—";

  const sessionShortId = (() => {
    const sid = getCookie("tm_session_public") || "";
    return sid.length > 6 ? sid.slice(-6) : sid || "—";
  })();

  const buildSnapshot = () => {
    const ds = result?.decisionSummary || {};
    const gr = ds.guardrails || {};
    const off = result?.offer;
    const snapshot = {
      timestamp: new Date().toISOString(),
      session: sessionShortId,
      assignments: {
        offerStrategy: ds.offerStrategy || null,
        riskModel: ds.modelsScored?.find((m) => m.model === "risk")?.variant || null,
        pricingModel: ds.modelsScored?.find((m) => m.model === "price")?.variant || null,
        riskTier: ds.riskTier || null,
      },
    };
    if (gr.applied?.length > 0) {
      snapshot.guardrails = {
        instantQuote: gr.instantQuoteEnabled,
        pricingEngine: gr.pricingEngineEnabled,
        applied: gr.applied,
      };
    }
    if (ds.modelResultsSummary) {
      const m = ds.modelResultsSummary;
      snapshot.modelResults = {
        riskScore: m.riskScore != null ? Math.round(m.riskScore) : null,
        priceFactor: m.priceFactor != null ? Number(m.priceFactor.toFixed(2)) : null,
        propensityScore: m.propensityScore != null ? Number(m.propensityScore.toFixed(2)) : null,
        riskTier: m.riskTier || null,
      };
    }
    if (ds.shadowResults) {
      snapshot.shadowResults = ds.shadowResults;
    }
    if (off) {
      snapshot.offer = {
        price: off.price,
        coverageTier: off.coverageTier,
        limits: off.limits || null,
      };
    }
    return snapshot;
  };

  const copySnapshot = async (event) => {
    const text = JSON.stringify(buildSnapshot(), null, 2);
    const btn = event.currentTarget;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      btn.textContent = "Copied!";
    } catch {
      btn.textContent = "Copy failed";
    }
    setTimeout(() => { btn.textContent = "Copy snapshot"; }, 1500);
  };

  const DemoPanel = () => {
    if (!demoPanelOpen) {
      return null;
    }

    const closePanel = () => setDemoPanelOpen(false);

    if (!result) {
      return html`
        <div className="demo-panel-overlay" onClick=${closePanel} />
        <div className="demo-panel">
          <button className="demo-panel-close" onClick=${closePanel} aria-label="Close">×</button>
          <h3>Demo Panel</h3>
          <div className="demo-panel-empty">Run a quote to see assignments and impact</div>
          <div className="demo-panel-section">
            <h4>Session</h4>
            <div className="demo-panel-row">
              <span className="label">Session ID</span>
              <span className="value">…${sessionShortId}</span>
            </div>
          </div>
          <div className="demo-panel-hint">Shift+D to toggle</div>
        </div>
      `;
    }

    const ds = result.decisionSummary || {};
    const gr = ds.guardrails || {};
    const off = result.offer;

    return html`
      <div className="demo-panel-overlay" onClick=${closePanel} />
      <div className="demo-panel">
        <button className="demo-panel-close" onClick=${closePanel} aria-label="Close">×</button>
        <h3>Demo Panel</h3>
        <p className="demo-panel-source">Values from server quote response (decisionSummary)</p>

        <div className="demo-panel-section">
          <h4>Assignments</h4>
          <div className="demo-panel-row">
            <span className="label">Offer strategy</span>
            <span className="value">${ds.offerStrategy || "—"}</span>
          </div>
          <div className="demo-panel-row">
            <span className="label">Risk model</span>
            <span className="value">${ds.modelsScored?.find((m) => m.model === "risk")?.variant || "—"}</span>
          </div>
          <div className="demo-panel-row">
            <span className="label">Pricing model</span>
            <span className="value">${ds.modelsScored?.find((m) => m.model === "price")?.variant || "—"}</span>
          </div>
          <div className="demo-panel-row">
            <span className="label">Risk tier</span>
            <span className="value">${ds.riskTier || "—"}</span>
          </div>
        </div>

        ${gr.applied?.length > 0 && html`
          <div className="demo-panel-section">
            <h4>Guardrails</h4>
            <div className="demo-panel-row">
              <span className="label">Instant quote</span>
              <span className="value">${gr.instantQuoteEnabled ? "enabled" : "disabled"}</span>
            </div>
            <div className="demo-panel-row">
              <span className="label">Pricing engine</span>
              <span className="value">${gr.pricingEngineEnabled ? "enabled" : "disabled"}</span>
            </div>
            <div className="demo-panel-row">
              <span className="label">Applied</span>
              <span className="value">${gr.applied.join(", ")}</span>
            </div>
          </div>
        `}

        ${ds.modelResultsSummary && (() => {
          const m = ds.modelResultsSummary;
          return html`
            <div className="demo-panel-section">
              <h4>Model Results</h4>
              <div className="demo-panel-row">
                <span className="label">Risk score</span>
                <span className="value">${m.riskScore != null ? Math.round(m.riskScore) : "—"}</span>
              </div>
              <div className="demo-panel-row">
                <span className="label">Price factor</span>
                <span className="value">${m.priceFactor != null ? m.priceFactor.toFixed(2) : "—"}</span>
              </div>
              <div className="demo-panel-row">
                <span className="label">Propensity score</span>
                <span className="value">${m.propensityScore != null ? m.propensityScore.toFixed(2) : "—"}</span>
              </div>
              <div className="demo-panel-row">
                <span className="label">Risk tier</span>
                <span className="value">${m.riskTier || "—"}</span>
              </div>
            </div>
          `;
        })()}

        ${ds.shadowResults && (() => {
          const sr = ds.shadowResults;
          const fl = sr.flags || {};
          const activeFlags = [fl.risk && "risk", fl.pricing && "pricing"].filter(Boolean).join(", ");
          const fmtD = (v, d) => d === 0 ? v.toFixed(d) : v.toFixed(d);
          const deltaClass = (d) => d > 0 ? "delta-positive" : d < 0 ? "delta-negative" : "delta-zero";
          const fmtDelta = (d, dec) => (d > 0 ? "+" : "") + d.toFixed(dec);
          return html`
            <div className="demo-panel-section">
              <h4>Shadow Comparison</h4>
              <div className="demo-panel-shadow-label">
                Active: ${activeFlags || "none"} · Variants: risk=${sr.shadowVariants?.risk || "—"}, pricing=${sr.shadowVariants?.pricing || "—"}
              </div>
              ${sr.riskScore && html`
                <div className="demo-panel-shadow-row">
                  <span>Risk score</span>
                  <span className="demo-panel-shadow-values">
                    ${sr.riskScore.assigned} → ${sr.riskScore.shadow}
                    <span className=${`demo-panel-shadow-delta ${deltaClass(sr.riskScore.delta)}`}>
                      (${fmtDelta(sr.riskScore.delta, 0)})
                    </span>
                  </span>
                </div>
              `}
              ${sr.riskTier && html`
                <div className="demo-panel-shadow-row">
                  <span>Risk tier</span>
                  <span className="demo-panel-shadow-values">
                    ${sr.riskTier.assigned} → ${sr.riskTier.shadow}
                  </span>
                </div>
              `}
              ${sr.priceFactor && html`
                <div className="demo-panel-shadow-row">
                  <span>Price factor</span>
                  <span className="demo-panel-shadow-values">
                    ${sr.priceFactor.assigned.toFixed(2)} → ${sr.priceFactor.shadow.toFixed(2)}
                    <span className=${`demo-panel-shadow-delta ${deltaClass(sr.priceFactor.delta)}`}>
                      (${fmtDelta(sr.priceFactor.delta, 2)})
                    </span>
                  </span>
                </div>
              `}
              ${sr.propensityScore && html`
                <div className="demo-panel-shadow-row">
                  <span>Propensity</span>
                  <span className="demo-panel-shadow-values">
                    ${sr.propensityScore.assigned.toFixed(2)} → ${sr.propensityScore.shadow.toFixed(2)}
                    <span className=${`demo-panel-shadow-delta ${deltaClass(-sr.propensityScore.delta)}`}>
                      (${fmtDelta(sr.propensityScore.delta, 2)})
                    </span>
                  </span>
                </div>
              `}
              <div className="demo-panel-shadow-label" style=${{ marginTop: "6px", fontStyle: "italic" }}>
                Decoupled: pricing shadow uses assigned risk score (per-model drift).
              </div>
            </div>
          `;
        })()}

        ${off && html`
          <div className="demo-panel-section">
            <h4>Offer</h4>
            <div className="demo-panel-row">
              <span className="label">Price</span>
              <span className="value">$${off.price?.toFixed(2)} / mo</span>
            </div>
            <div className="demo-panel-row">
              <span className="label">Coverage tier</span>
              <span className="value">${off.coverageTier || "—"}</span>
            </div>
            ${off.limits && html`
              <div className="demo-panel-row">
                <span className="label">BI liability</span>
                <span className="value">${off.limits.bodilyInjury || "—"}</span>
              </div>
              <div className="demo-panel-row">
                <span className="label">Property damage</span>
                <span className="value">${off.limits.propertyDamage || "—"}</span>
              </div>
              <div className="demo-panel-row">
                <span className="label">Collision deductible</span>
                <span className="value">${off.limits.collisionDeductible || "—"}</span>
              </div>
            `}
          </div>
        `}

        <div className="demo-panel-section">
          <h4>Session</h4>
          <div className="demo-panel-row">
            <span className="label">Session ID</span>
            <span className="value">…${sessionShortId}</span>
          </div>
        </div>

        <button className="demo-panel-copy" onClick=${copySnapshot}>Copy snapshot</button>
        <div className="demo-panel-hint">Shift+D to toggle</div>
      </div>
    `;
  };

  const stepOrder = [
    { id: "intake-address", label: "1. Address" },
    { id: "intake-personal", label: "2. Personal" },
    { id: "intake-vehicle", label: "3. Vehicle" },
    { id: "summary", label: "4. Summary" },
    { id: "checkout", label: "5. Checkout" },
    { id: "confirmation", label: "6. Confirm" },
  ];

  const Stepper = () => html`
    <div className="stepper">
      ${stepOrder.map((item, index) =>
        html`<span className=${step === item.id ? "active" : ""}>
            ${item.label}
          </span>
          ${index < stepOrder.length - 1 ? html`<span>→</span>` : ""}`
      )}
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
              <button type="button" onClick=${() => setStep("intake-address")}>
                Get a quote
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src="/assets/Friendly_tree_shrew_in_a_hoodie-30859d22-2387-4192-9f52-b81b25dc68f1.png"
              alt="ToMu Tree Shrew mascot"
            />
            ${ldReady &&
            mascotText &&
            html`<p className="muted mascot-text">${mascotText}</p>`}
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

      ${step === "intake-address" &&
      html`
        <div className="card">
          <h2>Home address</h2>
          <p className="muted">
            Start with a full address so we can estimate location-based risk.
          </p>
          <form onSubmit=${(event) => {
            event.preventDefault();
            setStep("intake-personal");
            if (ldReady) {
              identifyClientContext(buildClientContext(form, "address"));
            }
          }}>
            <div className="grid two">
              <label>
                Demo profile
                <select name="preset" value=${selectedPreset} onInput=${applyPreset}>
                  ${presets.map(
                    (preset) =>
                      html`<option value=${preset.id}>${preset.label}</option>`
                  )}
                </select>
              </label>
              <label>
                Address
                <input
                  name="address"
                  value=${form.address}
                  onInput=${updateField}
                  placeholder="123 Main St, City, ST 00000"
                />
              </label>
            </div>
            <div className="actions">
              <button type="submit">Next: Personal</button>
            </div>
          </form>
        </div>
      `}

      ${step === "intake-personal" &&
      html`
        <div className="card">
          <h2>Personal information</h2>
          <p className="muted">We use this to estimate driver risk.</p>
          <form onSubmit=${(event) => {
            event.preventDefault();
            setStep("intake-vehicle");
            if (ldReady) {
              if (!userKeyRef.current) {
                userKeyRef.current = generateUserKey();
              }
              identifyClientContext(buildClientContext(form, "personal"));
            }
          }}>
            <div className="grid two">
              <label>
                Full name
                <input
                  name="fullName"
                  value=${form.fullName}
                  onInput=${updateField}
                  placeholder="Taylor Morgan"
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
                Marital status
                <select
                  name="maritalStatus"
                  value=${form.maritalStatus}
                  onInput=${updateField}
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Number of kids
                <input
                  name="numberOfKids"
                  type="number"
                  min="0"
                  max="6"
                  value=${form.numberOfKids}
                  onInput=${updateField}
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick=${() => setStep("intake-address")}>
                Back
              </button>
              <button type="submit">Next: Vehicle</button>
            </div>
          </form>
        </div>
      `}

      ${step === "intake-vehicle" &&
      html`
        <div className="card">
          <h2>Vehicle details</h2>
          <p className="muted">Vehicle data influences pricing and coverage.</p>
          <form onSubmit=${(event) => {
            if (ldReady) {
              if (!userKeyRef.current) {
                userKeyRef.current = generateUserKey();
              }
              identifyClientContext(buildClientContext(form, "vehicle"));
            }
            submitQuote(event);
          }}>
            <div className="grid two">
              <label>
                Year
                <input
                  name="vehicleYear"
                  type="number"
                  min="1995"
                  max="2025"
                  value=${form.vehicleYear}
                  onInput=${updateField}
                />
              </label>
              <label>
                Make
                <input
                  name="vehicleMake"
                  value=${form.vehicleMake}
                  onInput=${updateField}
                  placeholder="Toyota"
                />
              </label>
              <label>
                Model
                <input
                  name="vehicleModel"
                  value=${form.vehicleModel}
                  onInput=${updateField}
                  placeholder="Highlander"
                />
              </label>
              <label>
                VIN
                <input
                  name="vehicleVin"
                  value=${form.vehicleVin}
                  onInput=${updateField}
                  placeholder="1HGCM82633A004352"
                />
              </label>
              <label>
                Odometer (miles)
                <input
                  name="vehicleOdometer"
                  type="number"
                  min="0"
                  value=${form.vehicleOdometer}
                  onInput=${updateField}
                />
              </label>
              <label>
                Annual mileage
                <input
                  name="vehicleAnnualMileage"
                  type="number"
                  min="0"
                  value=${form.vehicleAnnualMileage}
                  onInput=${updateField}
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick=${() => setStep("intake-personal")}>
                Back
              </button>
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
              <h3>Coverage highlights</h3>
              <p className="muted">
                BI liability: ${offer?.limits?.bodilyInjury || "—"}
              </p>
              <p className="muted">
                Property damage: ${offer?.limits?.propertyDamage || "—"}
              </p>
              <p className="muted">
                Medical payments: ${offer?.limits?.medicalPayments || "—"}
              </p>
              <p className="muted">
                Collision deductible: ${offer?.limits?.collisionDeductible || "—"}
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
                <p className="muted">Risk score: ${decision?.modelScores?.riskScore ?? "—"}</p>
                <p className="muted">
                  Price factor: ${decision?.modelScores?.priceFactor ?? "—"}
                </p>
                <p className="muted">
                  Propensity score: ${decision?.modelScores?.propensityScore ?? "—"}
                </p>
                <p className="muted">
                  Risk tier: ${riskTier} (calculated from address, profile, and vehicle)
                </p>
                ${decision?.modelsScored?.length
                  ? html`<p className="muted">
                      Models scored: ${decision.modelsScored
                        .map((item) => `${item.model} (${item.variant})`)
                        .join(", ")}
                    </p>`
                  : ""}
                ${decision?.riskFactors?.length
                  ? html`<ul className="muted">
                      ${decision.riskFactors.map(
                        (factor) => html`<li>${factor}</li>`
                      )}
                    </ul>`
                  : ""}
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
          ${error &&
          html`<p className="muted" style=${{ color: "#b91c1c" }}>${error}</p>`}
          <div className="actions">
            <button type="button" onClick=${submitCheckout} disabled=${checkoutLoading}>
              ${checkoutLoading ? "Processing..." : "Confirm policy"}
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
          ${confirmationId &&
          html`<p><strong>Confirmation:</strong> ${confirmationId}</p>`}
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

      <${DemoPanel} />
    </div>
  `;
};

const root = createRoot(document.getElementById("app"));
root.render(html`<${App} />`);
