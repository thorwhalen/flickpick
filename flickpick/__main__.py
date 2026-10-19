# PYTHON_ARGCOMPLETE_OK
"""CLI entry point: ``python -m flickpick {build,recommend,evaluate} --help``.

A refusal (a ``ValueError`` such as ``folds must be an integer of at least 2; got 1``)
or an unreadable file prints ``flickpick: <message>`` on stderr and exits 1, as the
Node CLI does; a usage error exits 2 (argparse). Anything else is a bug and keeps its
traceback.
"""

import sys

import cw

from flickpick.tools import CLI_CONFIG, CLI_FUNCS, cli_egress

#: exit codes shared with the Node CLI (``js/src/cli.ts``)
EXIT_ERROR = 1


def main(argv=None) -> int:
    """Dispatch the tool functions to the command line; returns the exit code."""
    try:
        return cw.dispatch(CLI_FUNCS, argv, config=CLI_CONFIG, egress=cli_egress)
    except (ValueError, OSError) as err:
        print(f"flickpick: {err}", file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
