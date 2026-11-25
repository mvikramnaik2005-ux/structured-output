"""
ai_generator.py
---------------
Communicates with the OpenAI API to generate structured JSON, validates every
response using `validator.py`, and automatically sends validation errors back
to the model for up to 3 repair attempts.
"""

import os
from dataclasses import dataclass, field
from typing import Any, List, Optional

from dotenv import load_dotenv
from openai import APIConnectionError, APIError, AuthenticationError, OpenAI, RateLimitError

from schema import UserProfile, get_schema_instructions
from validator import ValidationResult, validate_json_response


class ConfigurationError(Exception):
    """Raised when required environment variables (e.g., OPENAI_API_KEY) are missing."""


class AIConnectionError(Exception):
    """Raised when the OpenAI API request fails due to network, auth, or service issues."""


class MaxRetriesExceededError(Exception):
    """Raised when the AI fails to produce valid JSON within the maximum retry limit."""

    def __init__(self, message: str, attempts: List["AttemptRecord"]) -> None:
        super().__init__(message)
        self.attempts = attempts


@dataclass
class AttemptRecord:
    """Captures details of a single generation or repair attempt."""

    attempt_number: int
    phase: str  # "initial" or "repair"
    raw_response: str
    is_valid: bool
    errors: List[str] = field(default_factory=list)


@dataclass
class GenerationOutcome:
    """Final typed result returned only when schema validation succeeds."""

    profile: UserProfile
    attempts: List[AttemptRecord]
    total_retries_used: int


def create_openai_client() -> OpenAI:
    """Loads `.env` and initializes an authenticated OpenAI client."""
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or api_key == "your_openai_api_key_here":
        raise ConfigurationError(
            "OPENAI_API_KEY is not configured. Copy .env.example to .env and add your OpenAI API key."
        )
    return OpenAI(api_key=api_key)


def _call_model(client: Any, model: str, messages: List[dict]) -> str:
    """Sends chat completion messages to OpenAI and handles connection/API failures."""
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
        )
        content = response.choices[0].message.content
        return content if content is not None else ""
    except AuthenticationError as exc:
        raise AIConnectionError(
            "Authentication failed: Please verify your OPENAI_API_KEY in .env."
        ) from exc
    except RateLimitError as exc:
        raise AIConnectionError(
            "OpenAI API rate limit or quota exceeded. Please wait and try again."
        ) from exc
    except APIConnectionError as exc:
        raise AIConnectionError(
            f"Unable to connect to the OpenAI API. Check your internet connection: {exc}"
        ) from exc
    except APIError as exc:
        raise AIConnectionError(f"OpenAI API returned an error: {exc}") from exc
    except Exception as exc:
        raise AIConnectionError(f"Unexpected error calling AI model: {exc}") from exc


def generate_validated_profile(
    user_prompt: str,
    max_retries: int = 3,
    model: Optional[str] = None,
    client: Optional[Any] = None,
    verbose: bool = True,
) -> GenerationOutcome:
    """
    Requests structured JSON from the AI model and validates it strictly.

    If validation fails, the exact validation errors and faulty JSON are sent
    back to the model to repair, up to `max_retries` (default: 3) attempts.
    """
    if not user_prompt or not user_prompt.strip():
        raise ValueError("User prompt cannot be empty.")

    if max_retries < 0 or max_retries > 3:
        max_retries = min(max(max_retries, 0), 3)

    active_client = client if client is not None else create_openai_client()
    active_model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    system_prompt = (
        "You are a precise data extraction assistant.\n"
        f"{get_schema_instructions()}"
    )

    messages: List[dict] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt.strip()},
    ]

    attempts: List[AttemptRecord] = []
    total_attempts = 1 + max_retries  # Initial attempt + up to 3 repair retries

    for idx in range(total_attempts):
        phase = "initial" if idx == 0 else "repair"
        label = "Initial Attempt" if idx == 0 else f"Repair Retry {idx}/{max_retries}"

        if verbose:
            print(f"\n[{label}] Requesting JSON from model '{active_model}'...")

        raw_output = _call_model(active_client, active_model, messages)
        validation: ValidationResult = validate_json_response(raw_output)

        attempts.append(
            AttemptRecord(
                attempt_number=idx + 1,
                phase=phase,
                raw_response=raw_output,
                is_valid=validation.is_valid,
                errors=validation.errors,
            )
        )

        if validation.is_valid and validation.data is not None:
            if verbose:
                print(f"[{label}] Validation PASSED.")
            return GenerationOutcome(
                profile=validation.data,
                attempts=attempts,
                total_retries_used=idx,
            )

        if verbose:
            print(f"[{label}] Validation FAILED:")
            print(validation.error_summary)

        # If retries remain, append the faulty output and exact validation errors for repair
        if idx < max_retries:
            repair_feedback = (
                "Your previous response failed JSON schema validation.\n\n"
                "Validation errors:\n"
                f"{validation.error_summary}\n\n"
                "Please fix ALL errors above and return ONLY a valid JSON object matching the schema:\n"
                f"{get_schema_instructions()}"
            )
            messages.append({"role": "assistant", "content": raw_output})
            messages.append({"role": "user", "content": repair_feedback})

    raise MaxRetriesExceededError(
        f"Failed to produce valid JSON matching UserProfile after {max_retries} retry attempts.",
        attempts=attempts,
    )
