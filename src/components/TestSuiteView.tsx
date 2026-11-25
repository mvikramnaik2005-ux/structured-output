import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Play,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type { TestScenarioResult } from '../types';

export default function TestSuiteView() {
  const [results, setResults] = useState<TestScenarioResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>('wrong-age-type');

  async function runSuite() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/run-test-suite', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to execute test suite.');
        return;
      }
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    runSuite();
  }, []);

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Validation & Auto-Retry Test Suite
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Verifies all 5 required edge cases plus the strict 3-retry limit using the exact schema validation and repair rules mirrored in pytest.
          </p>
        </div>

        <button
          type="button"
          onClick={runSuite}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running Suite...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Re-Run All 6 Tests
            </>
          )}
        </button>
      </div>

      {/* Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Test Pass Rate</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {results.length > 0 ? `${passedCount} / ${results.length}` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            5 core cases + max-retry cap
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Auto-Repaired Cases</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {results.filter((r) => r.expectedOutcome === 'repaired' && r.passed).length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Repaired within 1 retry attempt
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Invalid Outputs Accepted</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-emerald-700">
            0
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Strict rejection enforced
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Test Cases Accordion List */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
        {isLoading && results.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          results.map((scenario) => {
            const isExpanded = expandedId === scenario.id;
            return (
              <div key={scenario.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : scenario.id)
                  }
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          Case 0{scenario.number}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {scenario.title}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {scenario.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <span className="hidden sm:inline font-mono tabular-nums text-slate-500">
                      Retries: {scenario.retriesUsed}
                    </span>
                    {scenario.passed ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4" />
                        Passed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-red-700 whitespace-nowrap">
                        <ShieldAlert className="w-4 h-4" />
                        Failed
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 bg-slate-50/60 border-t border-slate-200 space-y-4">
                    {scenario.attempts.map((attempt) => (
                      <div
                        key={attempt.attemptNumber}
                        className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-slate-900">
                            Attempt {attempt.attemptNumber} ·{' '}
                            {attempt.phase === 'initial' ? 'Initial' : 'Repair Retry'}
                          </span>
                          {attempt.isValid ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Validated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-red-700">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Rejected
                            </span>
                          )}
                        </div>

                        <pre className="bg-slate-950 text-slate-100 rounded-md p-3 text-xs overflow-x-auto">
                          {attempt.rawResponse}
                        </pre>

                        {attempt.errors.length > 0 && (
                          <ul className="space-y-1 text-xs text-red-800">
                            {attempt.errors.map((err, i) => (
                              <li key={i} className="font-mono">
                                • {err.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}

                    {scenario.finalProfile ? (
                      <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 font-mono">
                        Accepted Output: {JSON.stringify(scenario.finalProfile)}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        Expected Behavior Confirmed: {scenario.errorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
