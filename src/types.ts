export interface UserProfile {
  name: string;
  age: number;
  email: string;
  skills: string[];
  is_student: boolean;
}

export interface ValidationFieldError {
  field: string;
  rule: string;
  message: string;
  received: string;
}

export interface ValidationResult {
  isValid: boolean;
  data: UserProfile | null;
  errors: ValidationFieldError[];
  errorSummary: string;
}

export interface AttemptRecord {
  attemptNumber: number;
  phase: 'initial' | 'repair';
  rawResponse: string;
  isValid: boolean;
  errors: ValidationFieldError[];
  repairPromptSent?: string;
  durationMs: number;
}

export type FaultInjectionMode =
  | 'none'
  | 'missing_fields'
  | 'invalid_email'
  | 'wrong_age_type'
  | 'malformed_json'
  | 'unrepairable';

export interface GenerationOutcome {
  success: boolean;
  profile: UserProfile | null;
  attempts: AttemptRecord[];
  totalRetriesUsed: number;
  maxRetries: number;
  errorMessage?: string;
}

export interface TestScenarioResult {
  id: string;
  number: number;
  title: string;
  description: string;
  expectedOutcome: 'pass' | 'repaired' | 'rejected_max_retries';
  passed: boolean;
  retriesUsed: number;
  attempts: AttemptRecord[];
  finalProfile: UserProfile | null;
  errorMessage?: string;
}

export interface RepoFileEntry {
  path: string;
  name: string;
  language: 'python' | 'markdown' | 'text' | 'env';
  role: string;
  explanation: string;
  content: string;
}
