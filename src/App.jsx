import { useState, useMemo, useCallback } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// Shared Components
function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md p-6 border border-gray-100 ${className}`}>
      {title && <h2 className="font-serif text-2xl text-slate-900 mb-4">{title}</h2>}
      <div className="font-sans text-sm text-black/80">{children}</div>
    </div>
  );
}

function FormField({ id, label, children, error, helpText, required = false }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        {helpText && <span className="text-gray-500 text-xs font-normal ml-2">({helpText})</span>}
      </label>
      {children}
      {error && (
        <div className="text-red-600 text-xs mt-1" role="alert" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}

function ValidationMessage({ errors }) {
  if (!errors || Object.keys(errors).length === 0) return null;
  
  return (
    <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
      <h3 className="text-red-800 font-semibold text-sm mb-2">Please correct the following:</h3>
      <ul className="text-red-800 text-sm space-y-1">
        {Object.entries(errors).map(([field, error]) => (
          <li key={field}>• {error}</li>
        ))}
      </ul>
    </div>
  );
}

function ResultCard({ title, value, subtitle, description, isValid = true }) {
  if (!isValid) return null;
  
  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
      <div className="text-2xl font-serif text-blue-600 mb-2">{value}</div>
      <div className="text-sm text-gray-700">
        <div><strong>{title}</strong> - {subtitle}</div>
        <div className="mt-1">{description}</div>
      </div>
    </div>
  );
}

function safeParseFloat(value, fallback = 0) {
  const x = parseFloat(value);
  return Number.isFinite(x) ? x : fallback;
}

function computeOnePeriod({ S0, Su, Sd, K, rPct }) {
  const r = rPct / 100;
  const Cu = Math.max(Su - K, 0);
  const Cd = Math.max(Sd - K, 0);
  const Pu = Math.max(K - Su, 0);
  const Pd = Math.max(K - Sd, 0);
  const p = ((1 + r) * S0 - Sd) / (Su - Sd);
  const C0 = (p * Cu + (1 - p) * Cd) / (1 + r);
  const P0 = (p * Pu + (1 - p) * Pd) / (1 + r);
  return { Cu, Cd, Pu, Pd, C0, P0, p };
}

// Custom dot with value label next to each point (skips spacer row)
const makeLabeledDot = (key, color) => (props) => {
  const { cx, cy, payload } = props;
  if (payload?.t === " " || payload?.t === "  ") return null;
  const val = payload?.[key];
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || val == null) return null;
  const text = typeof val === 'number' ? val.toFixed(2) : String(val);
  
  // Adjust label position - higher for t=0 to avoid line collision
  const isStartingPoint = payload?.t === "t = 0";
  const labelY = isStartingPoint ? cy - 18 : cy - 8;
  
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} />
      <text x={cx + 6} y={labelY} fontSize={12} fill={color} fontWeight="bold">{text}</text>
    </g>
  );
};

export default function AccessibleOptionPricing() {
  const [inputs, setInputs] = useState({
    S0: 40,
    Su: 56,
    Sd: 32,
    K: 50,
    rPct: 5
  });

  const validateInputs = useCallback((inputs) => {
    const errors = {};
    const r = inputs.rPct / 100;
    
    if (!inputs.S0 || inputs.S0 <= 0) {
      errors.S0 = "Current asset price must be greater than 0";
    }
    if (!inputs.Su || inputs.Su <= 0) {
      errors.Su = "Up-state price must be greater than 0";
    }
    if (!inputs.Sd || inputs.Sd <= 0) {
      errors.Sd = "Down-state price must be greater than 0";
    }
    if (inputs.K < 0) {
      errors.K = "Strike price cannot be negative";
    }
    if (r <= -1) {
      errors.rPct = "Risk-free rate must be greater than -100%";
    }
    
    // Logical validations
    if (inputs.Su > 0 && inputs.Sd > 0 && inputs.Su <= inputs.Sd) {
      errors.upDown = "Up-state price must exceed down-state price";
    }
    if (inputs.S0 > 0 && inputs.Su > 0 && inputs.Sd > 0) {
      if (!(inputs.Sd < inputs.S0 && inputs.S0 < inputs.Su)) {
        errors.currentPrice = "Current price should lie between down-state and up-state prices";
      }
    }
    
    return errors;
  }, []);

  const handleInputChange = useCallback((field, value) => {
    setInputs(prev => ({ ...prev, [field]: safeParseFloat(value) }));
  }, []);

  const handleInputFocus = useCallback((event) => {
    event.target.select();
  }, []);

  const inputErrors = validateInputs(inputs);
  const calc = useMemo(() => {
    if (Object.keys(inputErrors).length > 0) return null;
    return computeOnePeriod(inputs);
  }, [inputs, inputErrors]);

  const assetData = useMemo(() => {
    if (!calc) return [];
    return [
      { t: " ", Up: null, Down: null },
      { t: "t = 0", Up: inputs.S0, Down: inputs.S0 },
      { t: "t = 1", Up: inputs.Su, Down: inputs.Sd },
      { t: "  ", Up: null, Down: null }
    ];
  }, [calc, inputs]);

  const callData = useMemo(() => {
    if (!calc) return [];
    return [
      { t: " ", Up: null, Down: null },
      { t: "t = 0", Up: calc.C0, Down: calc.C0 },
      { t: "t = 1", Up: calc.Cu, Down: calc.Cd },
      { t: "  ", Up: null, Down: null }
    ];
  }, [calc]);

  const putData = useMemo(() => {
    if (!calc) return [];
    return [
      { t: " ", Up: null, Down: null },
      { t: "t = 0", Up: calc.P0, Down: calc.P0 },
      { t: "t = 1", Up: calc.Pu, Down: calc.Pd },
      { t: "  ", Up: null, Down: null }
    ];
  }, [calc]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip Links */}
      <div className="sr-only focus-within:not-sr-only">
        <a 
          href="#main-content" 
          className="absolute top-0 left-0 bg-blue-600 text-white px-4 py-2 focus:relative focus:z-50"
        >
          Skip to main content
        </a>
        <a 
          href="#calculator-inputs" 
          className="absolute top-0 left-20 bg-blue-600 text-white px-4 py-2 focus:relative focus:z-50"
        >
          Skip to calculator
        </a>
        <a 
          href="#results-section" 
          className="absolute top-0 left-40 bg-blue-600 text-white px-4 py-2 focus:relative focus:z-50"
        >
          Skip to results
        </a>
      </div>

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        

        <Card title="Binomial Option Pricing Calculator">
          {/* Input Parameters */}
          <section aria-labelledby="inputs-heading">
            <h3 id="inputs-heading" className="font-serif text-lg text-slate-800 mb-4">Input Parameters</h3>
            <div id="calculator-inputs" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <FormField 
                id="S0" 
                label="Current Asset Price (S₀)" 
                helpText="$0 - $1000"
                error={inputErrors.S0}
                required
              >
                <input
                  id="S0"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  value={inputs.S0}
                  onChange={(e) => handleInputChange('S0', e.target.value)}
                  onFocus={handleInputFocus}
                  className="mt-1 rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby={inputErrors.S0 ? "S0-error" : undefined}
                  aria-invalid={inputErrors.S0 ? 'true' : 'false'}
                />
              </FormField>

              <FormField 
                id="Su" 
                label="Up-State Price (Su)" 
                helpText="Must be > S₀"
                error={inputErrors.Su}
                required
              >
                <input
                  id="Su"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  value={inputs.Su}
                  onChange={(e) => handleInputChange('Su', e.target.value)}
                  onFocus={handleInputFocus}
                  className="mt-1 rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby={inputErrors.Su ? "Su-error" : undefined}
                  aria-invalid={inputErrors.Su ? 'true' : 'false'}
                />
              </FormField>

              <FormField 
                id="Sd" 
                label="Down-State Price (Sd)" 
                helpText="Must be < S₀"
                error={inputErrors.Sd}
                required
              >
                <input
                  id="Sd"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  value={inputs.Sd}
                  onChange={(e) => handleInputChange('Sd', e.target.value)}
                  onFocus={handleInputFocus}
                  className="mt-1 rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby={inputErrors.Sd ? "Sd-error" : undefined}
                  aria-invalid={inputErrors.Sd ? 'true' : 'false'}
                />
              </FormField>

              <FormField 
                id="K" 
                label="Strike Price (K)" 
                helpText="$0 - $1000"
                error={inputErrors.K}
                required
              >
                <input
                  id="K"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  value={inputs.K}
                  onChange={(e) => handleInputChange('K', e.target.value)}
                  onFocus={handleInputFocus}
                  className="mt-1 rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby={inputErrors.K ? "K-error" : undefined}
                  aria-invalid={inputErrors.K ? 'true' : 'false'}
                />
              </FormField>

              <FormField 
                id="rPct" 
                label="Risk-Free Rate per Period (%)" 
                helpText="> -100%"
                error={inputErrors.rPct}
                required
              >
                <input
                  id="rPct"
                  type="number"
                  step="0.01"
                  min="-99"
                  max="50"
                  value={inputs.rPct}
                  onChange={(e) => handleInputChange('rPct', e.target.value)}
                  onFocus={handleInputFocus}
                  className="mt-1 rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby={inputErrors.rPct ? "rPct-error" : undefined}
                  aria-invalid={inputErrors.rPct ? 'true' : 'false'}
                />
              </FormField>
            </div>
          </section>

          <ValidationMessage errors={inputErrors} />

          {/* Results */}
          {calc && (
            <div id="results-section">
              {/* Key Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <ResultCard
                  title="Call Option Price (C₀)"
                  value={`$${calc.C0.toFixed(2)}`}
                  subtitle="fair value of the call option at t=0"
                  description={`Payoffs: Up-state $${calc.Cu.toFixed(2)}, Down-state $${calc.Cd.toFixed(2)}`}
                  isValid={true}
                />
                <ResultCard
                  title="Put Option Price (P₀)"
                  value={`$${calc.P0.toFixed(2)}`}
                  subtitle="fair value of the put option at t=0"
                  description={`Payoffs: Up-state $${calc.Pu.toFixed(2)}, Down-state $${calc.Pd.toFixed(2)}`}
                  isValid={true}
                />
              </div>

              {/* Screen Reader Data Tables */}
              <div className="sr-only">
                <h3>Asset Price Evolution</h3>
                <table>
                  <caption>Binomial tree showing asset price evolution from current time to expiration</caption>
                  <thead>
                    <tr>
                      <th scope="col">Time Period</th>
                      <th scope="col">Up Path</th>
                      <th scope="col">Down Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">t = 0 (Current)</th>
                      <td>$${inputs.S0.toFixed(2)}</td>
                      <td>$${inputs.S0.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th scope="row">t = 1 (Expiration)</th>
                      <td>$${inputs.Su.toFixed(2)}</td>
                      <td>$${inputs.Sd.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <h3>Call Option Values</h3>
                <table>
                  <caption>Call option values at each node of the binomial tree</caption>
                  <thead>
                    <tr>
                      <th scope="col">Time Period</th>
                      <th scope="col">Up Path</th>
                      <th scope="col">Down Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">t = 0 (Option Price)</th>
                      <td>$${calc.C0.toFixed(2)}</td>
                      <td>$${calc.C0.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th scope="row">t = 1 (Payoffs)</th>
                      <td>$${calc.Cu.toFixed(2)}</td>
                      <td>$${calc.Cd.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <h3>Put Option Values</h3>
                <table>
                  <caption>Put option values at each node of the binomial tree</caption>
                  <thead>
                    <tr>
                      <th scope="col">Time Period</th>
                      <th scope="col">Up Path</th>
                      <th scope="col">Down Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">t = 0 (Option Price)</th>
                      <td>$${calc.P0.toFixed(2)}</td>
                      <td>$${calc.P0.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th scope="row">t = 1 (Payoffs)</th>
                      <td>$${calc.Pu.toFixed(2)}</td>
                      <td>$${calc.Pd.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Visual Trees */}
              <section className="space-y-8">
                {/* Asset Price Tree */}
                <div>
                  <h4 className="font-serif text-lg text-slate-800 mb-3">Asset Price Evolution</h4>
                  <div className="h-80" 
                       role="img" 
                       aria-labelledby="asset-tree-title" 
                       aria-describedby="asset-tree-description">
                    
                    <div className="sr-only">
                      <h5 id="asset-tree-title">Asset Price Binomial Tree</h5>
                      <p id="asset-tree-description">
                        Line chart showing asset price evolution from ${inputs.S0.toFixed(2)} at t=0 to 
                        ${inputs.Su.toFixed(2)} (up-state) or ${inputs.Sd.toFixed(2)} (down-state) at t=1
                      </p>
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={assetData} margin={{ top: 50, right: 100, left: 30, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="t" 
                          allowDuplicatedCategory={false} 
                          label={{ value: "", position: "insideBottom", offset: -5 }} 
                        />
                        <YAxis 
                          label={{ value: "Asset Price", angle: -90, position: "insideLeft" }} 
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
                        <Legend />
                        <Line 
                          type="linear" 
                          dataKey="Up" 
                          name="Up Path" 
                          stroke="#059669" 
                          strokeWidth={2}
                          dot={makeLabeledDot('Up', '#059669')} 
                        />
                        <Line 
                          type="linear" 
                          dataKey="Down" 
                          name="Down Path" 
                          stroke="#dc2626" 
                          strokeWidth={2}
                          dot={makeLabeledDot('Down', '#dc2626')} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Call Option Tree */}
                <div>
                  <h4 className="font-serif text-lg text-slate-800 mb-3">Call Option Valuation</h4>
                  <div className="h-80" 
                       role="img" 
                       aria-labelledby="call-tree-title" 
                       aria-describedby="call-tree-description">
                    
                    <div className="sr-only">
                      <h5 id="call-tree-title">Call Option Binomial Tree</h5>
                      <p id="call-tree-description">
                        Line chart showing call option values from ${calc.C0.toFixed(2)} at t=0 to 
                        payoffs of ${calc.Cu.toFixed(2)} (up-state) or ${calc.Cd.toFixed(2)} (down-state) at t=1
                      </p>
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={callData} margin={{ top: 50, right: 100, left: 30, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="t" 
                          allowDuplicatedCategory={false} 
                          label={{ value: "", position: "insideBottom", offset: -5 }} 
                        />
                        <YAxis 
                          label={{ value: "Call Option Value", angle: -90, position: "insideLeft" }} 
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
                        <Legend />
                        <Line 
                          type="linear" 
                          dataKey="Up" 
                          name="Up Path" 
                          stroke="#059669" 
                          strokeWidth={2}
                          dot={makeLabeledDot('Up', '#059669')} 
                        />
                        <Line 
                          type="linear" 
                          dataKey="Down" 
                          name="Down Path" 
                          stroke="#dc2626" 
                          strokeWidth={2}
                          dot={makeLabeledDot('Down', '#dc2626')} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Put Option Tree */}
                <div>
                  <h4 className="font-serif text-lg text-slate-800 mb-3">Put Option Valuation</h4>
                  <div className="h-80" 
                       role="img" 
                       aria-labelledby="put-tree-title" 
                       aria-describedby="put-tree-description">
                    
                    <div className="sr-only">
                      <h5 id="put-tree-title">Put Option Binomial Tree</h5>
                      <p id="put-tree-description">
                        Line chart showing put option values from ${calc.P0.toFixed(2)} at t=0 to 
                        payoffs of ${calc.Pu.toFixed(2)} (up-state) or ${calc.Pd.toFixed(2)} (down-state) at t=1
                      </p>
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={putData} margin={{ top: 50, right: 100, left: 30, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="t" 
                          allowDuplicatedCategory={false} 
                          label={{ value: "", position: "insideBottom", offset: -5 }} 
                        />
                        <YAxis 
                          label={{ value: "Put Option Value", angle: -90, position: "insideLeft" }} 
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
                        <Legend />
                        <Line 
                          type="linear" 
                          dataKey="Up" 
                          name="Up Path" 
                          stroke="#059669" 
                          strokeWidth={2}
                          dot={makeLabeledDot('Up', '#059669')} 
                        />
                        <Line 
                          type="linear" 
                          dataKey="Down" 
                          name="Down Path" 
                          stroke="#dc2626" 
                          strokeWidth={2}
                          dot={makeLabeledDot('Down', '#dc2626')} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              {/* Educational Context */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
                <h4 className="font-semibold mb-2">Binomial Option Pricing Model:</h4>
               <p>
  This model values options by calculating payoffs at expiration and discounting them back to present value 
  using the risk-free rate. The binomial tree shows how option values evolve based on potential asset price movements.
</p>
              </div>
            </div>
          )}
        </Card>

        {/* Educational Footer */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold text-blue-800 mb-2">Educational Context</h2>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>Risk-Neutral Valuation:</strong> Options are priced using probabilities that make all assets earn the risk-free rate</p>
            <p><strong>No-Arbitrage Principle:</strong> Option prices prevent risk-free profit opportunities in the market</p>
            <p><strong>Call vs Put:</strong> Calls benefit from price increases, puts benefit from price decreases</p>
            <p className="text-xs mt-2">This single-period model forms the foundation for multi-period binomial trees and the Black-Scholes formula.</p>
          </div>
        </div>
      </main>
    </div>
  );
}