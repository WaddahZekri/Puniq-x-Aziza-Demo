import { createContext, useCallback, useContext, useState } from 'react';

const SimulationTimeContext = createContext(null);

// Generous rolling window, not a demo-facing limit — each entry is a
// handful of numbers, so this is purely a long-session memory backstop,
// set far above any realistic session length rather than a visible cap.
const MAX_HISTORY_ENTRIES = 240;

// Isolated, cleanly-removable simulation-time engine — tracks which
// simulated month the demo is "in" and a snapshot of headline totals at
// each month transition, so OverviewPanel's mini trend sparklines have an
// x-axis. This context only stores the result; deciding WHEN to advance
// (Manuel: a button click, Auto: a background timer) lives entirely in
// MapSimulationOverlay, the same isolated demo-tooling layer as the
// Manuel/Auto toggle and ticket auto-resolution.
export function SimulationTimeProvider({ children }) {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [monthlyHistory, setMonthlyHistory] = useState([]);

  const advanceMonth = useCallback(() => {
    setCurrentMonthIndex((prev) => prev + 1);
  }, []);

  // Idempotent by monthIndex (upsert, not push) — OverviewPanel's snapshot
  // effect re-runs on every render between transitions is avoided by its
  // own dependency array, but this stays safe to call more than once for
  // the same month regardless, rather than relying on that alone.
  const recordSnapshot = useCallback((monthIndex, snapshot) => {
    setMonthlyHistory((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.monthIndex === monthIndex);
      if (existingIndex === -1) return [...prev, { monthIndex, ...snapshot }].slice(-MAX_HISTORY_ENTRIES);
      const next = [...prev];
      next[existingIndex] = { monthIndex, ...snapshot };
      return next;
    });
  }, []);

  const value = { currentMonthIndex, monthlyHistory, advanceMonth, recordSnapshot };

  return <SimulationTimeContext.Provider value={value}>{children}</SimulationTimeContext.Provider>;
}

export function useSimulationTime() {
  const context = useContext(SimulationTimeContext);
  if (!context) {
    throw new Error('useSimulationTime must be used within a SimulationTimeProvider');
  }
  return context;
}
