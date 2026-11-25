import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { FaultInjectionMode, GenerationOutcome } from '../types';

const SAMPLE_PROMPTS: Array<{ label: string; text: string }> = [
  {
    label: 'CS Student',
    text: 'Create a profile for Maya Lin, 22 years old, studying computer science, email maya.lin@university.edu, skilled in Python, FastAPI, and PostgreSQL.',
  },
  {
    label: 'Backend Engineer',
    text: 'Generate JSON for Marcus Vance, age 31, senior engineer at marcus.vance@cloudops.io, knows Go, Kubernetes, and Terraform, not a student.',
  },
  {
    label: 'Data Analyst',
    text: 'Profile for Priya Patel, 25, email priya.patel@analytics.org, skills include SQL, Pandas, and Tableau, currently enrolled as a grad student.',
  },
];

const FAULT_MODES: Array<{ id: FaultInjectionMode; label: string; hint: string }> = [
  {
    id: 'none',
    label: 'Live AI Only',
    hint: 'Calls Gemini directly with schema rules and validates the real output.',
  },
  {
    id: 'missing_fields',
    label: 'Missing Fields',
    hint: 'Injects incomplete JSON on Attempt 1 so you can watch AI auto-repair.',
  },
  {
    id: 'invalid_email',
    label: 'Invalid Email',
    hint: 'Injects a broken email on Attempt 1 to test EmailStr rejection and repair.',
  },
  {
    id: 'wrong_age_type',
    label: 'Wrong Age Type',
    hint: 'Injects age: "twenty-four" on Attempt 1 to test strict integer checks.',
  },
  {
    id: 'malformed_json',
    label: 'Malformed JSON',
    hint: 'Injects broken syntax on Attempt 1 to test JSONDecodeError recovery.',
  },
  {
    id: 'unrepairable',
    label: 'Max Retry Limit',
    hint: 'Fails all 4 attempts to prove invalid JSON is rejected after 3 retries.',
  },
];

export default function LiveWorkbench() {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPTS[0].text);
  const [faultMode, setFaultMode] = useState<FaultInjectionMode>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [outcome, setOutcome] = useState<GenerationOutcome | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  async function handleRun(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setRequestError(null);
    setOutcome(null);

    try {
      const response = await fetch('/api/generate-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), faultMode }),
      });
      const data = await response.json();

      if (!response.ok) {
        setRequestError(data.error || 'Failed to generate and validate JSON.');
        return;
      }

      setOutcome(data as GenerationOutcome);
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : 'Network error connecting to server.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyFinalJson() {
    if (!outcome?.profile) return;
    await navigator.clipboard.writeText(JSON.stringify(outcome.profile, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  }

  const activeFaultMeta =
    FAULT_MODES.find((mode) => mode.id === faultMode) || FAULT_MODES[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Live JSON Generator & Auto-Retry Workbench
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Send a prompt, validate the AI output against the strict 5-field schema, and inspect how validation errors trigger up to 3 automated repair attempts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
          <span>Max Retries: 3</span>
          <span aria-hidden="true">·</span>
          <span>Strict Types: Enforced</span>
        </div>
      </div>

      {/* Prompt & Fault-Injection Controls */}
      <form
        onSubmit={handleRun}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            htmlFor="prompt-input"
            className="text-sm font-medium text-slate-900"
          >
            User Prompt
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Samples:</span>
            {SAMPLE_PROMPTS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setPrompt(sample.text)}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          id="prompt-input"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a person profile (name, age, email, skills, student status)..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
        />

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-slate-700">
              Attempt 1 Fault Injection (Test Auto-Repair Loop)
            </span>
            <span className="text-xs text-slate-500">{activeFaultMeta.hint}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {FAULT_MODES.map((mode) => {
              const active = faultMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFaultMode(mode.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setRequestError(null);
              setFaultMode('none');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Output
          </button>

          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validating & Repairing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Generate & Validate JSON
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error State */}
      {requestError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <p className="font-semibold">Execution Error</p>
            <p className="mt-0.5 text-red-800">{requestError}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-24 w-full bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-24 w-full bg-slate-100 rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="h-48 w-full bg-slate-100 rounded-lg animate-pulse" />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !outcome && !requestError && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            Ready to validate structured JSON
          </h2>
          <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
            Click Generate & Validate JSON above, or select a fault injection mode like Wrong Age Type to observe how schema errors are sent back to the AI for repair.
          </p>
        </div>
      )}

      {/* Results Layout */}
      {!isLoading && outcome && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Attempt-by-Attempt Trace */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Validation & Auto-Repair Trace
                </h2>
                <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  {outcome.attempts.length} total attempt{outcome.attempts.length === 1 ? '' : 's'}
                  {' · '}
                  {outcome.totalRetriesUsed} / {outcome.maxRetries} retries used
                </p>
              </div>
              {outcome.success ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Schema Validated</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Rejected (Max Retries)</span>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-200">
              {outcome.attempts.map((attempt) => (
                <div key={attempt.attemptNumber} className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className="font-mono tabular-nums">
                        Attempt {attempt.attemptNumber}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-600 font-normal">
                        {attempt.phase === 'initial' ? 'Initial Generation' : 'Auto-Repair Retry'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono tabular-nums text-slate-500">
                        {attempt.durationMs}ms
                      </span>
                      {attempt.isValid ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-red-700">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Failed ({attempt.errors.length} error{attempt.errors.length === 1 ? '' : 's'})
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1.5">
                      Raw Model Output
                    </div>
                    <pre className="bg-slate-950 text-slate-100 rounded-lg p-3.5 text-xs overflow-x-auto leading-relaxed">
                      {attempt.rawResponse}
                    </pre>
                  </div>

                  {attempt.errors.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-red-700">
                        Validation Errors Caught
                      </div>
                      <div className="border border-red-200 bg-red-50/70 rounded-lg divide-y divide-red-200/70">
                        {attempt.errors.map((err, index) => (
                          <div key={index} className="px-3.5 py-2.5 text-xs space-y-0.5">
                            <div className="font-mono font-semibold text-red-900">
                              {err.field} ({err.rule})
                            </div>
                            <div className="text-red-800">{err.message}</div>
                            <div className="font-mono text-red-700/90">
                              Received: {err.received}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attempt.repairPromptSent && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                      <span className="font-semibold">Repair Feedback Sent to Model: </span>
                      Sent the faulty output plus all {attempt.errors.length} field error(s) back to the AI to request a corrected JSON object.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Final Typed Output & Schema Check */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                Final Typed Output
              </h2>
              {outcome.profile && (
                <button
                  type="button"
                  onClick={handleCopyFinalJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy JSON
                    </>
                  )}
                </button>
              )}
            </div>

            {outcome.success && outcome.profile ? (
              <div className="p-6 space-y-6">
                <pre className="bg-slate-950 text-emerald-300 rounded-lg p-4 text-xs overflow-x-auto leading-relaxed">
                  {JSON.stringify(outcome.profile, null, 2)}
                </pre>

                <div className="border-t border-slate-200 pt-5">
                  <h3 className="text-xs font-semibold text-slate-500 mb-3">
                    Verified Schema Contract (UserProfile)
                  </h3>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2.5 font-mono font-medium text-slate-700">name</td>
                        <td className="py-2.5 font-mono text-slate-500">str</td>
                        <td className="py-2.5 text-right font-medium text-slate-900">
                          {outcome.profile.name}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-mono font-medium text-slate-700">age</td>
                        <td className="py-2.5 font-mono text-slate-500">StrictInt</td>
                        <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                          {outcome.profile.age}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-mono font-medium text-slate-700">email</td>
                        <td className="py-2.5 font-mono text-slate-500">EmailStr</td>
                        <td className="py-2.5 text-right font-mono text-slate-900 truncate max-w-[180px]">
                          {outcome.profile.email}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-mono font-medium text-slate-700">skills</td>
                        <td className="py-2.5 font-mono text-slate-500">list[str]</td>
                        <td className="py-2.5 text-right text-slate-900">
                          {outcome.profile.skills.join(', ')}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-mono font-medium text-slate-700">is_student</td>
                        <td className="py-2.5 font-mono text-slate-500">StrictBool</td>
                        <td className="py-2.5 text-right font-mono font-medium text-slate-900">
                          {String(outcome.profile.is_student)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900 space-y-1">
                  <p className="font-semibold">Invalid Output Rejected</p>
                  <p className="text-xs text-red-800">
                    {outcome.errorMessage ||
                      'Validation failed after the maximum 3 retry attempts. No invalid data was returned.'}
                  </p>
                </div>
                <p className="text-xs text-slate-600">
                  Safety rule enforced: the validator never silently coerces types or returns unverified JSON when retries are exhausted.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
