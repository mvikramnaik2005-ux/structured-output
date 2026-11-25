"""
main.py
-------
Beginner-friendly CLI entry point for the AI Structured JSON Generator with
Validation and Auto-Retry.

Supports:
  1. Live OpenAI generation from user prompts (`python main.py`)
  2. Interactive built-in demonstration of all 5 validation & retry test cases
     (`python main.py --demo` or choosing option 2 in the menu)
"""

import argparse
from typing import List

from ai_generator import (
    AIConnectionError,
    ConfigurationError,
    MaxRetriesExceededError,
    generate_validated_profile,
)


class _MockMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _MockChoice:
    def __init__(self, content: str) -> None:
        self.message = _MockMessage(content)


class _MockCompletionResponse:
    def __init__(self, content: str) -> None:
        self.choices = [_MockChoice(content)]


class SimulatedRepairClient:
    """
    Simulates an AI model returning predetermined responses across attempts so
    beginners can observe the validation and auto-repair loop without an API key.
    """

    def __init__(self, scripted_responses: List[str]) -> None:
        self._responses = list(scripted_responses)
        self._index = 0
        self.chat = self
        self.completions = self

    def create(self, **kwargs) -> _MockCompletionResponse:
        if self._index < len(self._responses):
            content = self._responses[self._index]
            self._index += 1
        else:
            content = self._responses[-1]
        return _MockCompletionResponse(content)


def run_demo_scenarios() -> None:
    """Runs all 5 required test scenarios offline using scripted AI outputs."""
    scenarios = [
        (
            "Scenario 1: Valid JSON on first attempt",
            "Create a profile for Maya Lin, 24, maya.lin@example.com, skills Python and FastAPI, student.",
            [
                '{"name": "Maya Lin", "age": 24, "email": "maya.lin@example.com", "skills": ["Python", "FastAPI"], "is_student": true}'
            ],
        ),
        (
            "Scenario 2: Missing required fields -> Auto-repaired on retry",
            "Create a profile for Liam Carter.",
            [
                '{"name": "Liam Carter", "age": 29}',
                '{"name": "Liam Carter", "age": 29, "email": "liam.carter@example.com", "skills": ["Docker", "Go"], "is_student": false}',
            ],
        ),
        (
            "Scenario 3: Invalid email -> Auto-repaired on retry",
            "Create a profile for Priya Nair.",
            [
                '{"name": "Priya Nair", "age": 21, "email": "priya-at-invalid", "skills": ["PyTorch"], "is_student": true}',
                '{"name": "Priya Nair", "age": 21, "email": "priya.nair@university.edu", "skills": ["PyTorch"], "is_student": true}',
            ],
        ),
        (
            "Scenario 4: Incorrect age data type -> Auto-repaired on retry",
            "Create a profile for Noah Brooks.",
            [
                '{"name": "Noah Brooks", "age": "twenty-six", "email": "noah@example.com", "skills": ["SQL"], "is_student": false}',
                '{"name": "Noah Brooks", "age": 26, "email": "noah@example.com", "skills": ["SQL"], "is_student": false}',
            ],
        ),
        (
            "Scenario 5: Completely malformed JSON -> Auto-repaired on retry",
            "Create a profile for Sofia Gomez.",
            [
                '{name: Sofia Gomez, "age": 23, broken_json_here',
                '{"name": "Sofia Gomez", "age": 23, "email": "sofia.gomez@example.com", "skills": ["TypeScript", "Python"], "is_student": true}',
            ],
        ),
    ]

    print("=" * 68)
    print("RUNNING 5 REQUIRED VALIDATION & AUTO-RETRY TEST SCENARIOS (OFFLINE DEMO)")
    print("=" * 68)

    for title, prompt, scripted in scenarios:
        print(f"\n--- {title} ---")
        mock_client = SimulatedRepairClient(scripted)
        outcome = generate_validated_profile(
            user_prompt=prompt,
            max_retries=3,
            model="simulated-gpt-4o-mini",
            client=mock_client,
            verbose=True,
        )
        print("Final Validated JSON Output:")
        print(outcome.profile.model_dump_json(indent=2))
        print(f"Retries used: {outcome.total_retries_used}")


def run_live_prompt(initial_prompt: str = "") -> None:
    """Prompts the user for input and calls the real OpenAI API."""
    prompt = initial_prompt.strip()
    if not prompt:
        print("\nDescribe the person profile you want the AI to generate as JSON.")
        print('Example: "Alice Johnson, 22 years old, studying CS, email alice@uni.edu, knows Python and Git"')
        prompt = input("\nYour prompt: ").strip()

    if not prompt:
        print("Error: Prompt cannot be empty.")
        return

    try:
        outcome = generate_validated_profile(user_prompt=prompt, max_retries=3, verbose=True)
        print("\n" + "=" * 68)
        print("VALIDATED TYPED OUTPUT (UserProfile)")
        print("=" * 68)
        print(outcome.profile.model_dump_json(indent=2))
        print(f"\nPython object: {repr(outcome.profile)}")
        print(f"Total retries used: {outcome.total_retries_used} / 3")
    except ConfigurationError as exc:
        print(f"\n[Configuration Error] {exc}")
    except AIConnectionError as exc:
        print(f"\n[API Connection Error] {exc}")
    except MaxRetriesExceededError as exc:
        print(f"\n[Validation Failed] {exc}")
        print("All attempts were rejected to prevent accepting invalid JSON.")
    except ValueError as exc:
        print(f"\n[Input Error] {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AI Structured JSON Generator with Validation and Auto-Retry"
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default="",
        help="Prompt to send directly to the OpenAI model.",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run the 5 built-in validation & retry test scenarios offline.",
    )
    args = parser.parse_args()

    if args.demo:
        run_demo_scenarios()
        return

    if args.prompt:
        run_live_prompt(args.prompt)
        return

    print("AI Structured JSON Generator with Validation and Auto-Retry")
    print("1. Generate JSON using live OpenAI API")
    print("2. Run 5 offline validation & auto-retry test scenarios")
    choice = input("\nSelect an option (1 or 2): ").strip()

    if choice == "2":
        run_demo_scenarios()
    else:
        run_live_prompt()


if __name__ == "__main__":
    main()
