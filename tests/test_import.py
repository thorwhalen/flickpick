"""``import flickpick`` stays light: pandas and scipy load only when a name needs them."""

import subprocess
import sys

import flickpick

HEAVY = ("pandas", "scipy")


def _modules_after(code: str) -> set[str]:
    out = subprocess.run(
        [sys.executable, "-c", f"{code}\nimport sys; print(' '.join(sys.modules))"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return set(out.split())


def test_import_does_not_load_pandas_or_scipy():
    loaded = _modules_after("import flickpick")
    assert "flickpick" in loaded
    assert not [m for m in HEAVY if m in loaded]


def test_lazy_names_resolve_on_access():
    loaded = _modules_after("from flickpick import holdout_evaluate")
    assert "flickpick.science" in loaded
    assert not [m for m in HEAVY if m in loaded]  # science imports scipy on first use
    for name in flickpick.__all__:
        assert getattr(flickpick, name) is not None
    assert set(flickpick.__all__) <= set(dir(flickpick))
