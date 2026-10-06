# PYTHON_ARGCOMPLETE_OK
"""CLI entry point: ``python -m flickpick {build,recommend,evaluate} --help``."""

import cw

from flickpick.tools import CLI_CONFIG, CLI_FUNCS, cli_egress


def main():
    """Dispatch the tool functions to the command line."""
    raise SystemExit(cw.dispatch(CLI_FUNCS, config=CLI_CONFIG, egress=cli_egress))


if __name__ == "__main__":
    main()
