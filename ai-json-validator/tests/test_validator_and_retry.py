"""
tests/test_validator_and_retry.py
---------------------------------
Automated pytest suite verifying all 5 required validation and auto-retry scenarios:
  1. Valid JSON
  2. Missing required fields
  3. Invalid email
  4. Incorrect age data type
  5. Completely malformed JSON
  (Plus: Max retry limit enforcement when errors persist across 3 retries)
"""

import sys
from pathlib import Path
import pytest

# Ensure project root is importable when running pytest from any working directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai_generator import MaxRetriesExceededError, generate_validated_profile
from main import SimulatedRepairClient
from schema import UserProfile
from validator import validate_json_response


# 1. Valid JSON
def test_valid_json_succeeds_without_retries():
    raw = '{"name": "Alice Johnson", "age": 22, "email": "alice@example.com", "skills": ["Python", "SQL"], "is_student": true}'
    result = validate_json_response(raw)

    assert result.is_valid is True
    assert isinstance(result.data, UserProfile)
    assert result.data.name == "Alice Johnson"
    assert result.data.age == 22
    assert result.data.email == "alice@example.com"
    assert result.data.skills == ["Python", "SQL"]
    assert result.data.is_student is True


# 2. Missing required fields
def test_missing_required_fields_rejected_and_repaired():
    bad_json = '{"name": "Bob Smith", "age": 30}'
    validation = validate_json_response(bad_json)

    assert validation.is_valid is False
    assert any("email" in err for err in validation.errors)
    assert any("skills" in err for err in validation.errors)
    assert any("is_student" in err for err in validation.errors)

    fixed_json = '{"name": "Bob Smith", "age": 30, "email": "bob@example.com", "skills": ["FastAPI"], "is_student": false}'
    client = SimulatedRepairClient([bad_json, fixed_json])
    outcome = generate_validated_profile("Profile for Bob", client=client, verbose=False)

    assert outcome.total_retries_used == 1
    assert outcome.profile.email == "bob@example.com"


# 3. Invalid email
def test_invalid_email_rejected_and_repaired():
    bad_email_json = '{"name": "Clara", "age": 25, "email": "not-an-email", "skills": ["Python"], "is_student": true}'
    validation = validate_json_response(bad_email_json)

    assert validation.is_valid is False
    assert any("email" in err for err in validation.errors)

    fixed_json = '{"name": "Clara", "age": 25, "email": "clara@example.org", "skills": ["Python"], "is_student": true}'
    client = SimulatedRepairClient([bad_email_json, fixed_json])
    outcome = generate_validated_profile("Profile for Clara", client=client, verbose=False)

    assert outcome.total_retries_used == 1
    assert outcome.profile.email == "clara@example.org"


# 4. Incorrect age data type (rejects strings like "25" and booleans)
def test_incorrect_age_data_type_rejected_and_repaired():
    bad_age_json = '{"name": "Dan", "age": "25", "email": "dan@example.com", "skills": ["Docker"], "is_student": false}'
    validation = validate_json_response(bad_age_json)

    assert validation.is_valid is False
    assert any("age" in err for err in validation.errors)

    fixed_json = '{"name": "Dan", "age": 25, "email": "dan@example.com", "skills": ["Docker"], "is_student": false}'
    client = SimulatedRepairClient([bad_age_json, fixed_json])
    outcome = generate_validated_profile("Profile for Dan", client=client, verbose=False)

    assert outcome.total_retries_used == 1
    assert outcome.profile.age == 25
    assert isinstance(outcome.profile.age, int)


# 5. Completely malformed JSON
def test_completely_malformed_json_rejected_and_repaired():
    malformed = "Sure! Here is the profile: {name: 'Eva', age: 27, missing_quotes"
    validation = validate_json_response(malformed)

    assert validation.is_valid is False
    assert any("Malformed JSON" in err for err in validation.errors)

    fixed_json = '{"name": "Eva", "age": 27, "email": "eva@example.com", "skills": ["ML", "Python"], "is_student": false}'
    client = SimulatedRepairClient([malformed, fixed_json])
    outcome = generate_validated_profile("Profile for Eva", client=client, verbose=False)

    assert outcome.total_retries_used == 1
    assert outcome.profile.name == "Eva"


# Bonus: Maximum retry limit (3 retries) strictly enforced
def test_max_retries_limit_enforced_when_always_invalid():
    always_broken = '{"name": "Broken", "age": "not-an-int"}'
    client = SimulatedRepairClient([always_broken, always_broken, always_broken, always_broken])

    with pytest.raises(MaxRetriesExceededError) as exc_info:
        generate_validated_profile("Broken profile", max_retries=3, client=client, verbose=False)

    # 1 initial attempt + 3 repair retries = 4 total attempts recorded
    assert len(exc_info.value.attempts) == 4
