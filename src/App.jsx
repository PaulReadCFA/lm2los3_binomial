import { useState, useMemo, useCallback } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// CFA-branded color palette
const COLORS = {
  primary: "#4476ff",
  dark: "#06005a",
  darkAlt: "#38337b",
  positive: "#6991ff",
  negative: "#ea792d",
  purple: "#7a46ff",
  purpleAlt: "#50037f",
  lightBlue: "#4476ff",
  orange: "#ea792d",
  darkText: "#06005a",
  green: "#059669",
  red: "#dc2626",
};

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md p-5 border border-gray-100 ${className}`}>
      <h2 className="font-serif text-xl text-slate-800 mb-3">{title}</h2>
      <div className="font-sans text-sm text-black/80">{children}</div>
    </div>
  );
}

function InfoIcon({ children, id }) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-gray-400 text-white text-xs font-bold hover:bg-gray-500 focus:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-describedby={`${id}-tooltip`}
        aria-label="More information"
      >
        ?
      </button>
      
      {showTooltip && (
        <div
          id={`${id}-tooltip`}
          role="tooltip"
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 max-w-xs"
        >
          {children}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}

function ValidationMessage({ errors }) {
  if (!errors || Object.keys(errors).length === 0) return null;
  
  return (
    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
      <h3 className="text-red-800 font-semibold text-sm mb-2">Please correct the following:</h3>
      <ul className="text-red-800 text-sm space-y-1">
        {Object.entries(errors).map(([field, error]) => (
          <li key={field}>• {error}</li>
        ))}
      </ul>
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

const makeLabeledDot = (key, color) => (props) => {
  const { cx, cy, payload } = props;
  if (payload?.t === " " || payload?.t === "  ") return null;
  const val = payload?.[key];
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || val == null) return null;
  const text = typeof val === 'number' ? val.toFixed(2) : String(val);
  
  const isStartingPoint = payload?.t === "t = 0";
  const labelY = isStartingPoint ? cy - 18 : cy - 8;
  
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} />
      <text x={cx + 6} y={labelY} fontSize={12} fill={color} fontWeight="bold">{text}</text>
    </g>
  );
};

function ResultsSection({ calc, inputs }) {
  return (
    <div className="space-y-6">
      {/* Call Option */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-3xl font-serif text-blue-600 mb-2">${calc.C0.toFixed(2)}</div>
        <div className="text-sm text-gray-700">
          <div><strong>Call Option Price (C₀)</strong> - fair value at t=0</div>
          <div className="mt-2 text-xs">
            Payoffs: Up ${calc.Cu.toFixed(2)}, Down ${calc.Cd.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Put Option */}
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="text-3xl font-serif text-purple-600 mb-2">${calc.P0.toFixed(2)}</div>
        <div className="text-sm text-gray-700">
          <div><strong>Put Option Price (P₀)</strong> - fair value at t=0</div>
          <div className="mt-2 text-xs">
            Payoffs: Up ${calc.Pu.toFixed(2)}, Down ${calc.Pd.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Risk-Neutral Probability */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-700">
          <div className="font-semibold mb-1">Risk-Neutral Probability</div>
          <div className="text-2xl font-mono text-gray-800">{(calc.p * 100).toFixed(2)}%</div>
          <div className="text-xs mt-1">Probability of up movement</div>
        </div>
      </div>
    </div>
  );
}

function OptionPricingCharts({ calc, inputs }) {
  const assetData = useMemo(() => [
    { t: " ", Up: null, Down: null },
    { t: "t = 0", Up: inputs.S0, Down: inputs.S0 },
    { t: "t = 1", Up: inputs.Su, Down: inputs.Sd },
    { t: "  ", Up: null, Down: null }
  ], [inputs]);

  const callData = useMemo(() => [
    { t: " ", Up: null, Down: null },
    { t: "t = 0", Up: calc.C0, Down: calc.C0 },
    { t: "t = 1", Up: calc.Cu, Down: calc.Cd },
    { t: "  ", Up: null, Down: null }
  ], [calc]);

  const putData = useMemo(() => [
    { t: " ", Up: null, Down: null },
    { t: "t = 0", Up: calc.P0, Down: calc.P0 },
    { t: "t = 1", Up: calc.Pu, Down: calc.Pd },
    { t: "  ", Up: null, Down: null }
  ], [calc]);

  return (
    <div className="space-y-8">
      {/* Asset Price Tree */}
      <div>
        <h3 className="font-serif text-lg text-slate-800 mb-3">Asset Price Evolution</h3>
        <div className="h-80" role="img" aria-labelledby="asset-tree-title">
          <div className="sr-only">
            <h4 id="asset-tree-title">Asset Price Binomial Tree</h4>
            <p>Line chart showing asset price from ${inputs.S0.toFixed(2)} to ${inputs.Su.toFixed(2)} (up) or ${inputs.Sd.toFixed(2)} (down)</p>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={assetData} margin={{ top: 50, right: 100, left: 30, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" />
              <YAxis label={{ value: "Asset Price", angle: -90, position: "insideLeft" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
              <Legend />
              <Line type="linear" dataKey="Up" name="Up Path" stroke={COLORS.green} strokeWidth={2} dot={makeLabeledDot('Up', COLORS.green)} />
              <Line type="linear" dataKey="Down" name="Down Path" stroke={COLORS.red} strokeWidth={2} dot={makeLabeledDot('Down', COLORS.red)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Call Option Tree */}
      <div>
        <h3 className="font-serif text-lg text-slate-800 mb-3">Call Option Valuation</h3>
        <div className="h-80" role="img" aria-labelledby="call-tree-title">
          <div className="sr-only">
            <h4 id="call-tree-title">Call Option Binomial Tree</h4>
            <p>Line chart showing call values from ${calc.C0.toFixed(2)} to ${calc.Cu.toFixed(2)} (up) or ${calc.Cd.toFixed(2)} (down)</p>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={callData} margin={{ top: 50, right: 100, left: 30, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" />
              <YAxis label={{ value: "Call Value", angle: -90, position: "insideLeft" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
              <Legend />
              <Line type="linear" dataKey="Up" name="Up Path" stroke={COLORS.green} strokeWidth={2} dot={makeLabeledDot('Up', COLORS.green)} />
              <Line type="linear" dataKey="Down" name="Down Path" stroke={COLORS.red} strokeWidth={2} dot={makeLabeledDot('Down', COLORS.red)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Put Option Tree */}
      <div>
        <h3 className="font-serif text-lg text-slate-800 mb-3">Put Option Valuation</h3>
        <div className="h-80" role="img" aria-labelledby="put-tree-title">
          <div className="sr-only">
            <h4 id="put-tree-title">Put Option Binomial Tree</h4>
            <p>Line chart showing put values from ${calc.P0.toFixed(2)} to ${calc.Pu.toFixed(2)} (up) or ${calc.Pd.toFixed(2)} (down)</p>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={putData} margin={{ top: 50, right: 100, left: 30, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" />
              <YAxis label={{ value: "Put Value", angle: -90, position: "insideLeft" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
              <Legend />
              <Line type="linear" dataKey="Up" name="Up Path" stroke={COLORS.green} strokeWidth={2} dot={makeLabeledDot('Up', COLORS.green)} />
              <Line type="linear" dataKey="Down" name="Down Path" stroke={COLORS.red} strokeWidth={2} dot={makeLabeledDot('Down', COLORS.red)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Educational note */}
      <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
        <strong>Binomial Model:</strong> Values options by calculating payoffs at expiration and discounting back using the risk-free rate.
      </div>
    </div>
  );
}

export default function App() {
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
    
    if (!inputs.S0 || inputs.S0 <= 0) errors.S0 = "Current price must be positive";
    if (!inputs.Su || inputs.Su <= 0) errors.Su = "Up-state price must be positive";
    if (!inputs.Sd || inputs.Sd <= 0) errors.Sd = "Down-state price must be positive";
    if (inputs.K < 0) errors.K = "Strike price cannot be negative";
    if (r <= -1) errors.rPct = "Risk-free rate must be > -100%";
    
    if (inputs.Su > 0 && inputs.Sd > 0 && inputs.Su <= inputs.Sd) {
      errors.upDown = "Up-state must exceed down-state";
    }
    if (inputs.S0 > 0 && inputs.Su > 0 && inputs.Sd > 0) {
      if (!(inputs.Sd < inputs.S0 && inputs.S0 < inputs.Su)) {
        errors.currentPrice = "Current price should be between down and up states";
      }
    }
    
    return errors;
  }, []);

  const handleInputChange = useCallback((field, value) => {
    setInputs(prev => ({ ...prev, [field]: safeParseFloat(value) }));
  }, []);

  const inputErrors = validateInputs(inputs);
  const calc = useMemo(() => {
    if (Object.keys(inputErrors).length > 0) return null;
    return computeOnePeriod(inputs);
  }, [inputs, inputErrors]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <main className="max-w-7xl mx-auto space-y-6">

        {/* RESULTS AND CHART */}
        {calc && (
          <>
            {/* MOBILE */}
            <div className="lg:hidden space-y-6">
              <Card title="Results">
                <ResultsSection calc={calc} inputs={inputs} />
              </Card>
              <Card title="Binomial Trees">
                <OptionPricingCharts calc={calc} inputs={inputs} />
              </Card>
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-1">
                <Card title="Results">
                  <ResultsSection calc={calc} inputs={inputs} />
                </Card>
              </div>
              <div className="lg:col-span-4">
                <Card title="Binomial Trees">
                  <OptionPricingCharts calc={calc} inputs={inputs} />
                </Card>
              </div>
            </div>
          </>
        )}

        {/* INPUTS */}
        <Card title="Binomial Option Pricing Calculator">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            
            <div className="flex items-center gap-2">
              <label htmlFor="S0" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Current Price (S₀)
                <span className="text-red-500 ml-1">*</span>
                <InfoIcon id="S0">Current asset price</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="S0"
                  type="number"
                  step="0.01"
                  value={inputs.S0}
                  onChange={(e) => handleInputChange('S0', e.target.value)}
                  className={`block w-full rounded-md shadow-sm px-2 py-2 text-sm ${
                    inputErrors.S0 ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="Su" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Up-State (Su)
                <span className="text-red-500 ml-1">*</span>
                <InfoIcon id="Su">Price if up</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="Su"
                  type="number"
                  step="0.01"
                  value={inputs.Su}
                  onChange={(e) => handleInputChange('Su', e.target.value)}
                  className={`block w-full rounded-md shadow-sm px-2 py-2 text-sm ${
                    inputErrors.Su ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="Sd" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Down-State (Sd)
                <span className="text-red-500 ml-1">*</span>
                <InfoIcon id="Sd">Price if down</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="Sd"
                  type="number"
                  step="0.01"
                  value={inputs.Sd}
                  onChange={(e) => handleInputChange('Sd', e.target.value)}
                  className={`block w-full rounded-md shadow-sm px-2 py-2 text-sm ${
                    inputErrors.Sd ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="K" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Strike (K)
                <span className="text-red-500 ml-1">*</span>
                <InfoIcon id="K">Option strike price</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="K"
                  type="number"
                  step="0.01"
                  value={inputs.K}
                  onChange={(e) => handleInputChange('K', e.target.value)}
                  className={`block w-full rounded-md shadow-sm px-2 py-2 text-sm ${
                    inputErrors.K ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="rPct" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Risk-Free Rate (%)
                <span className="text-red-500 ml-1">*</span>
                <InfoIcon id="rPct">Per period rate</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="rPct"
                  type="number"
                  step="0.01"
                  value={inputs.rPct}
                  onChange={(e) => handleInputChange('rPct', e.target.value)}
                  className={`block w-full rounded-md shadow-sm px-2 py-2 text-sm ${
                    inputErrors.rPct ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500`}
                />
              </div>
            </div>

          </div>
          
          <ValidationMessage errors={inputErrors} />
        </Card>

      </main>
    </div>
  );
}