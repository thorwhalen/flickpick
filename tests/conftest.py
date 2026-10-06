"""Shared fixtures: the small artifact set and the example ratings."""

from pathlib import Path

import pytest

from flickpick import read_artifacts, read_ratings

REPO = Path(__file__).parent.parent
FIXTURE_DIR = REPO / "tests" / "fixtures" / "artifacts_small"
EXAMPLE_RATINGS = REPO / "flickpick" / "data" / "examples" / "movie_ratings_various.csv"
PARITY_FILE = REPO / "tests" / "fixtures" / "parity" / "expected_recommend.json"


@pytest.fixture(scope="session")
def small():
    return read_artifacts(FIXTURE_DIR)


@pytest.fixture(scope="session")
def example_ratings():
    return read_ratings(EXAMPLE_RATINGS)


@pytest.fixture(scope="session")
def paths():
    return {
        "fixture_dir": FIXTURE_DIR,
        "example_ratings": EXAMPLE_RATINGS,
        "parity_file": PARITY_FILE,
    }
