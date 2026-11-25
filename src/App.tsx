import { useState } from 'react';
import {
  Braces,
  Download,
  FlaskConical,
  FolderGit2,
  Menu,
  Play,
  X,
} from 'lucide-react';
import LiveWorkbench from './components/LiveWorkbench';
import TestSuiteView from './components/TestSuiteView';
import RepoExplorerView from './components/RepoExplorerView';

type ActiveSection = 'workbench' | 'tests' | 'repo';

const SCHEMA_FIELDS = [
  { name: 'name', type: 'str', rule: 'Non-empty string' },
  { name: 'age', type: 'StrictInt', rule: 'Integer 1–130' },
  { name: 'email', type: 'EmailStr', rule: 'Valid email' },
  { name: 'skills', type: 'list[str]', rule: '1+ non-empty items' },
  { name: 'is_student', type: 'StrictBool', rule: 'true or false' },
];

export default function App() {
  const [section, setSection] = useState<ActiveSection>('workbench');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sectionLabel =
    section === 'workbench'
      ? 'Live Workbench'
      : section === 'tests'
        ? 'Test Suite (5+1)'
        : 'Python Repository';

  function navigateTo(target: ActiveSection) {
    setSection(target);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle workspace navigation"
            className="lg:hidden p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <a
            href="#workbench"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('workbench');
            }}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            AI JSON Validator
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => navigateTo('workbench')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              section === 'workbench'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Workbench
          </button>
          <button
            type="button"
            onClick={() => navigateTo('tests')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              section === 'tests'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Test Suite
          </button>
          <button
            type="button"
            onClick={() => navigateTo('repo')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              section === 'repo'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Python Repo
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <a
            href="/api/python-repo/download"
            download="ai-json-validator.zip"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download Repo ZIP
          </a>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Sidebar Navigation (256px desktop, slide-over on mobile) */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-14 left-0 z-20 block' : 'hidden'
          } lg:block w-64 shrink-0 bg-white border-r border-slate-200 p-5 flex flex-col justify-between`}
        >
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2 px-2">
                Workspace
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => navigateTo('workbench')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    section === 'workbench'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Play className="w-4 h-4 shrink-0" />
                  Live Workbench
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('tests')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    section === 'tests'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FlaskConical className="w-4 h-4 shrink-0" />
                  Test Suite (5+1)
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('repo')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    section === 'repo'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FolderGit2 className="w-4 h-4 shrink-0" />
                  Python Repository
                </button>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3 px-1">
                <Braces className="w-3.5 h-3.5 text-slate-500" />
                <span>UserProfile Schema</span>
              </div>
              <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                {SCHEMA_FIELDS.map((field) => (
                  <div key={field.name} className="py-2 px-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-slate-800">
                        {field.name}
                      </span>
                      <span className="font-mono text-slate-500">{field.type}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {field.rule}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="font-medium text-slate-700">Python Target Stack</div>
            <div>OpenAI · Pydantic v2 · dotenv</div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
          <div className="mb-4 text-xs text-slate-500 flex items-center gap-2">
            <span className="font-mono">ai-json-validator</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">{sectionLabel}</span>
          </div>

          {section === 'workbench' && <LiveWorkbench />}
          {section === 'tests' && <TestSuiteView />}
          {section === 'repo' && <RepoExplorerView />}
        </main>
      </div>
    </div>
  );
}
