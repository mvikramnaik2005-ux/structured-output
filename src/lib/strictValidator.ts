import type { UserProfile, ValidationFieldError, ValidationResult } from '../types.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_KEYS = new Set(['name', 'age', 'email', 'skills', 'is_student']);

export const SCHEMA_INSTRUCTIONS = `You must return ONLY a valid JSON object matching this exact schema:
{
  "name": string (non-empty full name),
  "age": integer (strict whole number between 1 and 130, e.g., 22, NOT "22" and NOT a boolean),
  "email": string (valid email address, e.g., "alex@university.edu"),
  "skills": array of strings (at least one non-empty skill, e.g., ["Python", "SQL"]),
  "is_student": boolean (strictly true or false, NOT "true")
}
Do not include markdown code fences, explanations, or extra fields.`;

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match ? match[1].trim() : trimmed;
}

function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array (${JSON.stringify(value)})`;
  return `${typeof value} (${JSON.stringify(value)})`;
}

export function validateJsonResponse(rawResponse: string): ValidationResult {
  if (!rawResponse || !rawResponse.trim()) {
    const errors: ValidationFieldError[] = [
      {
        field: 'root',
        rule: 'non_empty',
        message: 'Empty response: AI returned no JSON content.',
        received: 'empty string',
      },
    ];
    return {
      isValid: false,
      data: null,
      errors,
      errorSummary: errors.map((e) => `- ${e.message}`).join('\n'),
    };
  }

  const cleaned = stripMarkdownFences(rawResponse);
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Invalid JSON syntax';
    const errors: ValidationFieldError[] = [
      {
        field: 'root',
        rule: 'valid_json',
        message: `Malformed JSON: ${reason}`,
        received: cleaned.slice(0, 120),
      },
    ];
    return {
      isValid: false,
      data: null,
      errors,
      errorSummary: errors.map((e) => `- ${e.message}`).join('\n'),
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const errors: ValidationFieldError[] = [
      {
        field: 'root',
        rule: 'json_object',
        message: 'Invalid JSON root type: Expected a JSON object {...}.',
        received: describeValue(parsed),
      },
    ];
    return {
      isValid: false,
      data: null,
      errors,
      errorSummary: errors.map((e) => `- ${e.message}`).join('\n'),
    };
  }

  const record = parsed as Record<string, unknown>;
  const errors: ValidationFieldError[] = [];

  // Reject extra unknown keys (mirrors Pydantic extra="forbid")
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      errors.push({
        field: key,
        rule: 'extra_forbidden',
        message: `Field '${key}': Extra inputs are not permitted.`,
        received: describeValue(record[key]),
      });
    }
  }

  // 1. name (Strict non-empty string)
  if (!('name' in record)) {
    errors.push({
      field: 'name',
      rule: 'required',
      message: "Field 'name': Missing required field.",
      received: 'missing',
    });
  } else if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    errors.push({
      field: 'name',
      rule: 'non_empty_string',
      message: "Field 'name': Input should be a non-empty string.",
      received: describeValue(record.name),
    });
  }

  // 2. age (Strict integer between 1 and 130; rejects strings like "25", floats, booleans)
  if (!('age' in record)) {
    errors.push({
      field: 'age',
      rule: 'required',
      message: "Field 'age': Missing required field.",
      received: 'missing',
    });
  } else if (
    typeof record.age !== 'number' ||
    !Number.isInteger(record.age) ||
    record.age < 1 ||
    record.age > 130
  ) {
    errors.push({
      field: 'age',
      rule: 'strict_integer',
      message: "Field 'age': Input should be a strict integer between 1 and 130 (not a string or float).",
      received: describeValue(record.age),
    });
  }

  // 3. email (Valid email string)
  if (!('email' in record)) {
    errors.push({
      field: 'email',
      rule: 'required',
      message: "Field 'email': Missing required field.",
      received: 'missing',
    });
  } else if (typeof record.email !== 'string' || !EMAIL_REGEX.test(record.email.trim())) {
    errors.push({
      field: 'email',
      rule: 'valid_email',
      message: "Field 'email': Value is not a valid email address (must contain '@' and a valid domain).",
      received: describeValue(record.email),
    });
  }

  // 4. skills (Non-empty array of non-empty strings)
  if (!('skills' in record)) {
    errors.push({
      field: 'skills',
      rule: 'required',
      message: "Field 'skills': Missing required field.",
      received: 'missing',
    });
  } else if (
    !Array.isArray(record.skills) ||
    record.skills.length === 0 ||
    record.skills.some((item) => typeof item !== 'string' || item.trim().length === 0)
  ) {
    errors.push({
      field: 'skills',
      rule: 'string_array',
      message: "Field 'skills': Input should be a non-empty list of non-empty strings.",
      received: describeValue(record.skills),
    });
  }

  // 5. is_student (Strict boolean)
  if (!('is_student' in record)) {
    errors.push({
      field: 'is_student',
      rule: 'required',
      message: "Field 'is_student': Missing required field.",
      received: 'missing',
    });
  } else if (typeof record.is_student !== 'boolean') {
    errors.push({
      field: 'is_student',
      rule: 'strict_boolean',
      message: "Field 'is_student': Input should be a strict boolean (true or false, not a string).",
      received: describeValue(record.is_student),
    });
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      data: null,
      errors,
      errorSummary: errors.map((e) => `- ${e.message}`).join('\n'),
    };
  }

  const cleanProfile: UserProfile = {
    name: (record.name as string).trim(),
    age: record.age as number,
    email: (record.email as string).trim(),
    skills: (record.skills as string[]).map((s) => s.trim()),
    is_student: record.is_student as boolean,
  };

  return {
    isValid: true,
    data: cleanProfile,
    errors: [],
    errorSummary: '',
  };
}
