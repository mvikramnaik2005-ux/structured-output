import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { GoogleGenAI, type Content } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { SCHEMA_INSTRUCTIONS, validateJsonResponse } from './src/lib/strictValidator.ts';
import type {
  AttemptRecord,
  FaultInjectionMode,
  GenerationOutcome,
  RepoFileEntry,
  TestScenarioResult,
} from './src/types.ts';

const PORT = 3000;
const MAX_RETRIES = 3;
const GEMINI_MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getInjectedFaultResponse(mode: FaultInjectionMode): string | null {
  switch (mode) {
    case 'missing_fields':
      return JSON.stringify({
        name: 'Jordan Taylor',
        age: 24,
      });
    case 'invalid_email':
      return JSON.stringify({
        name: 'Jordan Taylor',
        age: 24,
        email: 'jordan.taylor-invalid-email',
        skills: ['Python', 'Pydantic'],
        is_student: true,
      });
    case 'wrong_age_type':
      return JSON.stringify({
        name: 'Jordan Taylor',
        age: 'twenty-four',
        email: 'jordan.taylor@example.com',
        skills: ['Python', 'Pydantic'],
        is_student: true,
      });
    case 'malformed_json':
      return '{name: "Jordan Taylor", age: 24, email: "jordan@example.com", skills: ["Python"';
    case 'unrepairable':
      return '{"name": "Broken Payload", "age": "not_an_integer", "email": "bad"}';
    case 'none':
    default:
      return null;
  }
}

const REPO_FILE_SPECS: Array<{
  relPath: string;
  name: string;
  language: RepoFileEntry['language'];
  role: string;
  explanation: string;
}> = [
  {
    relPath: 'main.py',
    name: 'main.py',
    language: 'python',
    role: 'CLI Entry Point & Offline Demo Runner',
    explanation:
      'Provides an easy interactive menu and CLI flags (--prompt and --demo). Lets beginners run live OpenAI generation or test all 5 validation & auto-repair scenarios offline.',
  },
  {
    relPath: 'schema.py',
    name: 'schema.py',
    language: 'python',
    role: 'Strict Pydantic Schema Definition',
    explanation:
      'Defines the UserProfile BaseModel with StrictStr, StrictInt, EmailStr, List[StrictStr], StrictBool, and extra="forbid" so type coercion bugs like "25" for age are never silently accepted.',
  },
  {
    relPath: 'validator.py',
    name: 'validator.py',
    language: 'python',
    role: 'JSON Parser & Error Formatter',
    explanation:
      'Safely parses raw text with json.loads(), catches malformed JSON syntax, ensures a JSON object root, runs UserProfile.model_validate(), and formats clear field-level error reports.',
  },
  {
    relPath: 'ai_generator.py',
    name: 'ai_generator.py',
    language: 'python',
    role: 'OpenAI Client & 3-Attempt Auto-Retry Loop',
    explanation:
      'Loads OPENAI_API_KEY via python-dotenv, handles OpenAI connection/auth/rate-limit errors, and sends exact validation errors back to the model for up to 3 repair retries.',
  },
  {
    relPath: 'tests/test_validator_and_retry.py',
    name: 'tests/test_validator_and_retry.py',
    language: 'python',
    role: 'Automated Pytest Suite (5 Required Scenarios)',
    explanation:
      'Tests valid JSON, missing fields, invalid email, wrong age data type, completely malformed JSON, and max-retry limit enforcement without spending API credits.',
  },
  {
    relPath: 'requirements.txt',
    name: 'requirements.txt',
    language: 'text',
    role: 'Python Dependencies',
    explanation:
      'Pins openai, pydantic, email-validator, python-dotenv, and pytest for reproducible virtual environment installs.',
  },
  {
    relPath: '.env.example',
    name: '.env.example',
    language: 'env',
    role: 'Safe Environment Template',
    explanation:
      'Shows contributors which environment variables are needed (OPENAI_API_KEY, OPENAI_MODEL) without exposing real secrets.',
  },
  {
    relPath: '.gitignore',
    name: '.gitignore',
    language: 'text',
    role: 'GitHub Security Hygiene',
    explanation:
      'Prevents .env secrets, virtual environments (venv/), and Python caches (__pycache__/) from ever being committed to a public GitHub repository.',
  },
  {
    relPath: 'README.md',
    name: 'README.md',
    language: 'markdown',
    role: 'Complete Repository Documentation',
    explanation:
      'Documents project overview, installation, API key setup, file explanations, validation/retry architecture, example I/O, and testing instructions.',
  },
];

function readPythonRepoFiles(): RepoFileEntry[] {
  const repoRoot = path.resolve(process.cwd(), 'ai-json-validator');
  return REPO_FILE_SPECS.map((spec) => {
    const fullPath = path.resolve(repoRoot, spec.relPath);
    if (!fullPath.startsWith(repoRoot)) {
      throw new Error(`Invalid repository file path: ${spec.relPath}`);
    }
    const content = fs.existsSync(fullPath)
      ? fs.readFileSync(fullPath, 'utf-8')
      : `# Missing file: ${spec.relPath}`;
    return {
      path: spec.relPath,
      name: spec.name,
      language: spec.language,
      role: spec.role,
      explanation: spec.explanation,
      content,
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Live AI JSON Generation + Strict Validation + Auto-Retry (Max 3 Retries)
  app.post('/api/generate-validate', async (req, res) => {
    const { prompt, faultMode = 'none' } = (req.body || {}) as {
      prompt?: string;
      faultMode?: FaultInjectionMode;
    };

    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt must be a non-empty string.' });
      return;
    }

    const validFaultModes: FaultInjectionMode[] = [
      'none',
      'missing_fields',
      'invalid_email',
      'wrong_age_type',
      'malformed_json',
      'unrepairable',
    ];
    const activeFaultMode: FaultInjectionMode = validFaultModes.includes(faultMode)
      ? faultMode
      : 'none';

    let ai: GoogleGenAI | null = null;
    if (activeFaultMode !== 'unrepairable') {
      try {
        ai = getGeminiClient();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Missing Gemini API key.';
        res.status(500).json({ error: message });
        return;
      }
    }

    const systemInstruction = `You are a precise data extraction assistant.\n${SCHEMA_INSTRUCTIONS}`;
    const conversation: Content[] = [
      {
        role: 'user',
        parts: [{ text: prompt.trim() }],
      },
    ];

    const attempts: AttemptRecord[] = [];
    const totalAttempts = 1 + MAX_RETRIES; // Initial attempt + up to 3 repair retries

    try {
      for (let idx = 0; idx < totalAttempts; idx++) {
        const phase: AttemptRecord['phase'] = idx === 0 ? 'initial' : 'repair';
        const startedAt = Date.now();
        let rawResponse = '';

        const injectedFault =
          activeFaultMode === 'unrepairable'
            ? getInjectedFaultResponse('unrepairable')
            : idx === 0
              ? getInjectedFaultResponse(activeFaultMode)
              : null;

        if (injectedFault !== null) {
          rawResponse = injectedFault;
        } else if (ai) {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: conversation,
            config: {
              systemInstruction,
            },
          });
          rawResponse = response.text ?? '';
        }

        const durationMs = Math.max(1, Date.now() - startedAt);
        const validation = validateJsonResponse(rawResponse);

        let repairPromptSent: string | undefined;
        if (!validation.isValid && idx < MAX_RETRIES) {
          repairPromptSent =
            `Your previous response failed JSON schema validation.\n\n` +
            `Validation errors:\n${validation.errorSummary}\n\n` +
            `Please fix ALL errors above and return ONLY a valid JSON object matching the schema:\n${SCHEMA_INSTRUCTIONS}`;
        }

        attempts.push({
          attemptNumber: idx + 1,
          phase,
          rawResponse,
          isValid: validation.isValid,
          errors: validation.errors,
          repairPromptSent,
          durationMs,
        });

        if (validation.isValid && validation.data) {
          const outcome: GenerationOutcome = {
            success: true,
            profile: validation.data,
            attempts,
            totalRetriesUsed: idx,
            maxRetries: MAX_RETRIES,
          };
          res.json(outcome);
          return;
        }

        if (repairPromptSent) {
          conversation.push({
            role: 'model',
            parts: [{ text: rawResponse }],
          });
          conversation.push({
            role: 'user',
            parts: [{ text: repairPromptSent }],
          });
        }
      }

      const failedOutcome: GenerationOutcome = {
        success: false,
        profile: null,
        attempts,
        totalRetriesUsed: MAX_RETRIES,
        maxRetries: MAX_RETRIES,
        errorMessage: `Validation failed after ${MAX_RETRIES} repair retries. Invalid output was rejected.`,
      };
      res.json(failedOutcome);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Upstream AI service request failed.';
      res.status(502).json({
        error: `AI request failed: ${message}`,
        attempts,
      });
    }
  });

  // Deterministic 5-scenario (+ max retry limit) test runner mirroring tests/test_validator_and_retry.py
  app.post('/api/run-test-suite', (_req, res) => {
    const scenarioDefinitions: Array<{
      id: string;
      number: number;
      title: string;
      description: string;
      expectedOutcome: TestScenarioResult['expectedOutcome'];
      scriptedResponses: string[];
    }> = [
      {
        id: 'valid-json',
        number: 1,
        title: 'Valid JSON on First Attempt',
        description:
          'AI returns a complete JSON object with exact types matching UserProfile.',
        expectedOutcome: 'pass',
        scriptedResponses: [
          JSON.stringify({
            name: 'Alice Johnson',
            age: 22,
            email: 'alice@example.com',
            skills: ['Python', 'SQL'],
            is_student: true,
          }),
        ],
      },
      {
        id: 'missing-fields',
        number: 2,
        title: 'Missing Required Fields',
        description:
          'Attempt 1 omits email, skills, and is_student. Validator catches missing fields and repair retry completes them.',
        expectedOutcome: 'repaired',
        scriptedResponses: [
          JSON.stringify({ name: 'Bob Smith', age: 30 }),
          JSON.stringify({
            name: 'Bob Smith',
            age: 30,
            email: 'bob@example.com',
            skills: ['FastAPI', 'Docker'],
            is_student: false,
          }),
        ],
      },
      {
        id: 'invalid-email',
        number: 3,
        title: 'Invalid Email Address',
        description:
          'Attempt 1 supplies "not-an-email". Validator rejects invalid email format and repair retry provides a valid address.',
        expectedOutcome: 'repaired',
        scriptedResponses: [
          JSON.stringify({
            name: 'Clara Diaz',
            age: 25,
            email: 'not-an-email',
            skills: ['Python'],
            is_student: true,
          }),
          JSON.stringify({
            name: 'Clara Diaz',
            age: 25,
            email: 'clara@example.org',
            skills: ['Python'],
            is_student: true,
          }),
        ],
      },
      {
        id: 'wrong-age-type',
        number: 4,
        title: 'Incorrect Age Data Type',
        description:
          'Attempt 1 sends age as string "25". Strict integer enforcement rejects coercion and repair retry returns integer 25.',
        expectedOutcome: 'repaired',
        scriptedResponses: [
          JSON.stringify({
            name: 'Dan Miller',
            age: '25',
            email: 'dan@example.com',
            skills: ['Docker'],
            is_student: false,
          }),
          JSON.stringify({
            name: 'Dan Miller',
            age: 25,
            email: 'dan@example.com',
            skills: ['Docker'],
            is_student: false,
          }),
        ],
      },
      {
        id: 'malformed-json',
        number: 5,
        title: 'Completely Malformed JSON',
        description:
          'Attempt 1 returns conversational text and broken syntax. JSON parser rejects it and repair retry outputs clean JSON.',
        expectedOutcome: 'repaired',
        scriptedResponses: [
          "Sure! Here is the profile: {name: 'Eva', age: 27, unclosed_json",
          JSON.stringify({
            name: 'Eva Park',
            age: 27,
            email: 'eva@example.com',
            skills: ['Machine Learning', 'Python'],
            is_student: false,
          }),
        ],
      },
      {
        id: 'max-retries-enforced',
        number: 6,
        title: 'Maximum 3-Retry Limit Enforced',
        description:
          'All attempts return invalid data. System stops strictly after 3 retries and rejects invalid output instead of accepting it.',
        expectedOutcome: 'rejected_max_retries',
        scriptedResponses: [
          '{"name": "Broken", "age": "invalid"}',
          '{"name": "Broken", "age": "invalid"}',
          '{"name": "Broken", "age": "invalid"}',
          '{"name": "Broken", "age": "invalid"}',
        ],
      },
    ];

    const results: TestScenarioResult[] = scenarioDefinitions.map((scenario) => {
      const attempts: AttemptRecord[] = [];
      let finalProfile = null;
      let retriesUsed = 0;

      for (let idx = 0; idx < 1 + MAX_RETRIES; idx++) {
        const raw =
          scenario.scriptedResponses[
            Math.min(idx, scenario.scriptedResponses.length - 1)
          ];
        const validation = validateJsonResponse(raw);
        const repairPromptSent =
          !validation.isValid && idx < MAX_RETRIES
            ? `Validation errors:\n${validation.errorSummary}\nPlease fix ALL errors and return ONLY valid JSON.`
            : undefined;

        attempts.push({
          attemptNumber: idx + 1,
          phase: idx === 0 ? 'initial' : 'repair',
          rawResponse: raw,
          isValid: validation.isValid,
          errors: validation.errors,
          repairPromptSent,
          durationMs: 2,
        });

        if (validation.isValid && validation.data) {
          finalProfile = validation.data;
          retriesUsed = idx;
          break;
        }
        retriesUsed = idx;
      }

      const passed =
        scenario.expectedOutcome === 'pass'
          ? finalProfile !== null && retriesUsed === 0
          : scenario.expectedOutcome === 'repaired'
            ? finalProfile !== null && retriesUsed > 0 && retriesUsed <= MAX_RETRIES
            : finalProfile === null && attempts.length === 1 + MAX_RETRIES;

      return {
        id: scenario.id,
        number: scenario.number,
        title: scenario.title,
        description: scenario.description,
        expectedOutcome: scenario.expectedOutcome,
        passed,
        retriesUsed,
        attempts,
        finalProfile,
        errorMessage:
          finalProfile === null
            ? `Rejected after ${MAX_RETRIES} repair retries.`
            : undefined,
      };
    });

    res.json({ results });
  });

  // Expose real Python repo files for inspection in the UI
  app.get('/api/python-repo', (_req, res) => {
    try {
      const files = readPythonRepoFiles();
      res.json({ files });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load Python project files.';
      res.status(500).json({ error: message });
    }
  });

  // Export complete GitHub-ready ai-json-validator.zip
  app.get('/api/python-repo/download', async (_req, res) => {
    try {
      const files = readPythonRepoFiles();
      const zip = new JSZip();
      const rootFolder = zip.folder('ai-json-validator');
      if (!rootFolder) {
        throw new Error('Failed to create ZIP archive folder.');
      }
      for (const file of files) {
        rootFolder.file(file.path, file.content);
      }
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="ai-json-validator.zip"'
      );
      res.send(buffer);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to build ZIP archive.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
