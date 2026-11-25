import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileText,
  FolderGit2,
  Terminal,
} from 'lucide-react';
import type { RepoFileEntry } from '../types';

export default function RepoExplorerView() {
  const [files, setFiles] = useState<RepoFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('main.py');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadRepo() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/python-repo');
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Could not load Python repository files.');
          return;
        }
        setFiles(data.files || []);
        if (data.files?.length > 0) {
          setSelectedPath(data.files[0].path);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error.');
      } finally {
        setIsLoading(false);
      }
    }
    loadRepo();
  }, []);

  const selectedFile =
    files.find((f) => f.path === selectedPath) || files[0] || null;

  async function handleCopyCode() {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const lines = selectedFile ? selectedFile.content.split('\n') : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Python Repository Explorer
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Browse the complete beginner-friendly Python codebase (OpenAI SDK, Pydantic v2, python-dotenv, and pytest) structured for a public GitHub submission.
          </p>
        </div>

        <a
          href="/api/python-repo/download"
          download="ai-json-validator.zip"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Download ai-json-validator.zip
        </a>
      </div>

      {/* Quick Start Commands Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-900">
          <Terminal className="w-4 h-4 text-slate-500 shrink-0" />
          <span>Quick Start (Local Python Setup)</span>
        </div>
        <div className="font-mono text-xs bg-slate-950 text-slate-100 rounded-lg px-4 py-2.5 overflow-x-auto whitespace-nowrap">
          cp .env.example .env && pip install -r requirements.txt && python main.py --demo && pytest -v
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Explorer Split Panel */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* File List */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 divide-y divide-slate-200">
          <div className="px-4 py-3 bg-slate-50 flex items-center gap-2 text-xs font-semibold text-slate-700">
            <FolderGit2 className="w-4 h-4 text-slate-500" />
            <span className="font-mono">ai-json-validator/</span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {files.map((file) => {
                const isSelected = file.path === selectedFile?.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedPath(file.path)}
                    className={`w-full px-4 py-3 text-left transition-colors flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50/70 text-blue-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {file.language === 'python' ? (
                      <FileCode2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isSelected ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                    ) : (
                      <FileText
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isSelected ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold truncate">
                        {file.path}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {file.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* File Viewer & Beginner Explanation */}
        <div className="lg:col-span-8 flex flex-col min-w-0">
          {selectedFile ? (
            <>
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-mono text-sm font-semibold text-slate-900">
                    ai-json-validator/{selectedFile.path}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedFile.role} · {lines.length} lines
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied File
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>

              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900">How this file works: </span>
                {selectedFile.explanation}
              </div>

              <div className="bg-slate-950 text-slate-100 overflow-x-auto max-h-[560px] overflow-y-auto p-4 text-xs leading-relaxed">
                <table className="w-full border-collapse font-mono">
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/70">
                        <td className="select-none pr-4 text-right text-slate-500 tabular-nums w-10 align-top">
                          {idx + 1}
                        </td>
                        <td className="whitespace-pre text-slate-100">{line || ' '}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-8 text-sm text-slate-500">
              Select a file on the left to inspect its source code.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
