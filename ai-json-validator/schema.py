"""
schema.py
---------
Defines the strict Pydantic data schema (`UserProfile`) that every AI-generated
JSON response must satisfy before the application accepts it.
"""

from typing import List
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StrictBool,
    StrictInt,
    StrictStr,
    field_validator,
)


class UserProfile(BaseModel):
    """Validated user profile returned only after strict schema checks pass."""

    # Reject unexpected extra fields so the AI output stays strictly aligned with the contract.
    model_config = ConfigDict(extra="forbid")

    name: StrictStr = Field(
        ...,
        min_length=1,
        description="Full name of the person as a non-empty string.",
    )
    age: StrictInt = Field(
        ...,
        ge=1,
        le=130,
        description="Age as a strict integer (not a string or boolean), between 1 and 130.",
    )
    email: EmailStr = Field(
        ...,
        description="A valid email address (e.g., alice@example.com).",
    )
    skills: List[StrictStr] = Field(
        ...,
        min_length=1,
        description="A non-empty list of skill strings.",
    )
    is_student: StrictBool = Field(
        ...,
        description="A strict boolean (true or false) indicating student status.",
    )

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty or whitespace only.")
        return cleaned

    @field_validator("skills")
    @classmethod
    def skills_must_contain_non_empty_strings(cls, value: List[str]) -> List[str]:
        cleaned_skills = [skill.strip() for skill in value if skill.strip()]
        if not cleaned_skills:
            raise ValueError("skills must contain at least one non-empty string.")
        return cleaned_skills


def get_schema_instructions() -> str:
    """Returns a clear, human-readable JSON contract for the AI prompt."""
    return """You must return ONLY a valid JSON object matching this exact schema:
{
  "name": string (non-empty full name),
  "age": integer (strict whole number, e.g., 22, NOT "22" and NOT a boolean),
  "email": string (valid email address, e.g., "alex@university.edu"),
  "skills": array of strings (at least one skill, e.g., ["Python", "SQL"]),
  "is_student": boolean (strictly true or false, NOT "true")
}
Do not include markdown code fences, explanations, or extra fields."""
