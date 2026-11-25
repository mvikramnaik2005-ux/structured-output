"""
validator.py
------------
Parses raw text returned by the AI model, validates it against the Pydantic
`UserProfile` schema, and formats clear, actionable error messages when invalid.
"""

import json
import re
from dataclasses import dataclass, field
from typing import List, Optional

from pydantic import ValidationError

from schema import UserProfile


@dataclass
class ValidationResult:
    """Holds the outcome of parsing and validating a raw AI JSON response."""

    is_valid: bool
    data: Optional[UserProfile] = None
    errors: List[str] = field(default_factory=list)
    raw_text: str = ""

    @property
    def error_summary(self) -> str:
        """Returns a formatted multi-line error report for display or AI repair."""
        if not self.errors:
            return ""
        return "\n".join(f"- {err}" for err in self.errors)


def _strip_markdown_fences(raw_text: str) -> str:
    """
    Removes optional ```json ... ``` wrappers if the model accidentally adds them,
    while preserving invalid syntax so malformed JSON is still caught.
    """
    stripped = raw_text.strip()
    fence_match = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", stripped, re.DOTALL | re.IGNORECASE)
    if fence_match:
        return fence_match.group(1).strip()
    return stripped


def _format_pydantic_errors(exc: ValidationError) -> List[str]:
    """Converts Pydantic ValidationError details into beginner-friendly messages."""
    formatted_errors: List[str] = []
    for err in exc.errors():
        location = ".".join(str(part) for part in err.get("loc", ())) or "root"
        message = err.get("msg", "Invalid value")
        input_value = err.get("input", None)
        error_type = err.get("type", "validation_error")

        if error_type == "missing":
            formatted_errors.append(f"Field '{location}': Missing required field.")
        else:
            formatted_errors.append(
                f"Field '{location}': {message} (received {type(input_value).__name__}: {input_value!r})."
            )
    return formatted_errors


def validate_json_response(raw_response: str) -> ValidationResult:
    """
    Strictly parses `raw_response` as JSON and validates it with `UserProfile`.

    Never silently coerces bad types or accepts partial objects.
    """
    if not raw_response or not raw_response.strip():
        return ValidationResult(
            is_valid=False,
            errors=["Empty response: AI returned no JSON content."],
            raw_text=raw_response or "",
        )

    cleaned_text = _strip_markdown_fences(raw_response)

    # Step 1: Parse raw text as JSON
    try:
        parsed = json.loads(cleaned_text)
    except json.JSONDecodeError as exc:
        return ValidationResult(
            is_valid=False,
            errors=[
                f"Malformed JSON: {exc.msg} at line {exc.lineno}, column {exc.colno}."
            ],
            raw_text=raw_response,
        )

    # Step 2: Ensure top-level JSON value is an object/dictionary
    if not isinstance(parsed, dict):
        return ValidationResult(
            is_valid=False,
            errors=[
                f"Invalid JSON root type: Expected a JSON object {{...}}, got {type(parsed).__name__}."
            ],
            raw_text=raw_response,
        )

    # Step 3: Validate fields & strict types using Pydantic
    try:
        profile = UserProfile.model_validate(parsed)
        return ValidationResult(
            is_valid=True,
            data=profile,
            errors=[],
            raw_text=raw_response,
        )
    except ValidationError as exc:
        return ValidationResult(
            is_valid=False,
            errors=_format_pydantic_errors(exc),
            raw_text=raw_response,
        )
