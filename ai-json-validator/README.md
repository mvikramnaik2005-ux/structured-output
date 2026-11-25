# AI Structured JSON Generator with Validation and Auto-Retry

A beginner-friendly, modular Python application that prompts an OpenAI model to return structured JSON data, strictly validates the output against a Pydantic schema, and automatically feeds validation errors back to the model for up to **3 repair attempts** before accepting or rejecting the result.

---

## Project Overview

Large Language Models can occasionally return malformed JSON, omit required keys, invent invalid email addresses, or return numbers as strings (for example `"25"` instead of `25`). Accepting unvalidated AI output causes downstream crashes.

This project solves that problem with a strict **Generate -> Validate -> Auto-Repair** pipeline:
1. Prompts the AI model with explicit JSON schema instructions.
2. Parses the raw text and validates every field and data type with **Pydantic v2** strict types.
3. Sends exact validation errors back to the AI model to repair the JSON (maximum 3 retries).
4. Returns only validated, typed Python objects (`UserProfile`)—never silently accepting invalid data.

---

## Features

- **Strict Pydantic Schema (`UserProfile`)**: Validates `name` (`str`), `age` (`StrictInt`), `email` (`EmailStr`), `skills` (`List[StrictStr]`), and `is_student` (`StrictBool`).
- **Zero Silent Coercion**: Rejects `"25"` as an age string or `"true"` as a student string, catching subtle type bugs early.
- **Automated Error-Feedback Retry Loop**: Sends exact field-level errors and faulty output back to the AI model up to **3 times**.
- **Comprehensive Error Handling**: Gracefully handles missing `.env` API keys, OpenAI connection/rate-limit errors, malformed JSON syntax, missing fields, invalid emails, and retry-limit exhaustion.
- **Offline Demo & Pytest Suite**: Includes an offline 5-scenario demo (`python main.py --demo`) and automated `pytest` tests requiring zero API credits.

---

## Technologies Used

- **Python 3.10+**
- **OpenAI Python SDK** (`openai`)
- **Pydantic v2 + Email Validator** (`pydantic`, `email-validator`)
- **JSON** (Python standard library `json`)
- **Python Dotenv** (`python-dotenv`)
- **Pytest** (`pytest`)

---

## Project Structure & How Each File Works

```text
ai-json-validator/
│
├── main.py                              # CLI entry point (live OpenAI mode + offline 5-scenario demo)
├── schema.py                            # Defines the strict Pydantic `UserProfile` model & prompt schema text
├── validator.py                         # Parses JSON safely & formats human-readable Pydantic validation errors
├── ai_generator.py                      # Connects to OpenAI, runs the 3-retry repair loop, handles API errors
├── requirements.txt                     # Lists all Python package dependencies
├── .env.example                         # Safe environment template (no real API keys)
├── .gitignore                           # Excludes `.env`, `__pycache__/`, virtual environments, and test caches
├── README.md                            # Complete setup, usage, architecture, and testing guide
└── tests/
    └── test_validator_and_retry.py      # Automated pytest suite for all 5 required test scenarios
```

### File-by-File Explanation

- **`schema.py`**: Defines the `UserProfile` class inheriting from Pydantic's `BaseModel`. Uses `StrictInt`, `StrictBool`, `StrictStr`, and `EmailStr` along with `extra="forbid"` so extra fields, missing fields, blank names, and wrong types are immediately caught.
- **`validator.py`**: Contains `validate_json_response(raw_response)`. First strips accidental Markdown code fences, parses raw text with `json.loads()`, verifies the root is a dictionary, and runs `UserProfile.model_validate()`. Returns a `ValidationResult` object containing either the typed `UserProfile` or clean, field-by-field error strings.
- **`ai_generator.py`**: Loads `OPENAI_API_KEY` from `.env` using `python-dotenv`, builds the initial system/user conversation, calls OpenAI Chat Completions, and runs the bounded retry loop (`Initial Attempt` + up to `3 Repair Retries`). If validation fails, it appends the AI's faulty response plus the exact validation errors as feedback so the model can correct itself.
- **`main.py`**: Beginner-friendly command-line interface offering two modes: live OpenAI generation from your prompt, or an offline `--demo` mode demonstrating all 5 test cases with simulated repair responses.
- **`tests/test_validator_and_retry.py`**: Uses `pytest` and a lightweight `SimulatedRepairClient` to verify valid JSON, missing fields, invalid email, wrong age type, malformed JSON, and max-retry enforcement deterministically.

---

## Installation Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ai-json-validator.git
   cd ai-json-validator
   ```

2. **Create and activate a virtual environment**
   ```bash
   python -m venv venv
   # macOS / Linux:
   source venv/bin/activate
   # Windows (PowerShell):
   venv\Scripts\Activate.ps1
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

---

## API Key Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-key-here
   OPENAI_MODEL=gpt-4o-mini
   ```
   > **Security Note:** `.env` is listed in `.gitignore`, ensuring your API key is never committed to GitHub.

---

## How to Run the Project

### Interactive Menu
```bash
python main.py
```

### Direct Prompt Mode (Live OpenAI)
```bash
python main.py --prompt "Generate a profile for Elena Rostova, 26, elena@robotics.io, skilled in Python, ROS2, and C++, not a student."
```

### Offline 5-Scenario Demo (No API Key Needed)
```bash
python main.py --demo
```

### Run Automated Tests
```bash
pytest -v
```

---

## Example Input and Output

**Input Prompt:**
```text
Create a profile for Alice Johnson, 22 years old, studying computer science, email alice@university.edu, skilled in Python and FastAPI.
```

**Simulated Repair Flow (when Attempt 1 fails):**
```text
[Initial Attempt] Requesting JSON from model 'gpt-4o-mini'...
[Initial Attempt] Validation FAILED:
- Field 'age': Input should be a valid integer (received str: '22').
- Field 'email': value is not a valid email address: An email address must have an @-sign.

[Repair Retry 1/3] Requesting JSON from model 'gpt-4o-mini'...
[Repair Retry 1/3] Validation PASSED.
```

**Final Validated Output:**
```json
{
  "name": "Alice Johnson",
  "age": 22,
  "email": "alice@university.edu",
  "skills": [
    "Python",
    "FastAPI"
  ],
  "is_student": true
}
```

---

## Validation and Retry Mechanism

```text
  User Prompt ──▶ OpenAI Model ──▶ Raw Text Response
                                          │
                                          ▼
                              json.loads() + Pydantic
                                    ┌─────┴─────┐
                                  Valid       Invalid
                                    │           │
                                    ▼           ▼
                          Return Typed     Retries < 3?
                           UserProfile     ├── Yes ──▶ Send Errors Back to Model
                                           └── No  ──▶ Raise MaxRetriesExceededError
```

1. **Initial Attempt**: Calls OpenAI with explicit schema rules.
2. **Validation Gate**: Rejects malformed JSON, missing fields, bad emails, or wrong data types.
3. **Repair Feedback**: Appends the invalid JSON + exact error list to the message history and requests a corrected JSON object.
4. **Hard Cap (3 Retries)**: Stops after 3 repair attempts and raises `MaxRetriesExceededError` so invalid data is never silently accepted.

---

## Testing Coverage

All 5 required scenarios are verified in `tests/test_validator_and_retry.py`:
1. **Valid JSON**: Passes immediately with `0` retries.
2. **Missing required fields**: Rejected on initial attempt, repaired on retry.
3. **Invalid email**: Rejected by Pydantic `EmailStr`, repaired on retry.
4. **Incorrect age data type**: String `"25"` rejected by `StrictInt`, repaired to `25`.
5. **Completely malformed JSON**: Caught via `json.JSONDecodeError`, repaired on retry.

---

## GitHub Submission Checklist

- [x] `.env` is ignored in `.gitignore` and never committed.
- [x] `.env.example` provides safe placeholder keys.
- [x] `requirements.txt` lists all dependencies.
- [x] `README.md` documents installation, configuration, usage, and architecture.
- [x] Modular code structure (`main.py`, `schema.py`, `ai_generator.py`, `validator.py`).
