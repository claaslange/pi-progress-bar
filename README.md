# @claaslange/pi-progress-bar

A small [pi](https://github.com/badlogic/pi) package that emits terminal progress updates via `OSC 9;4`.

## Why this package exists

This package was inspired by [HazAT/pi-ghostty](https://github.com/HazAT/pi-ghostty).

That extension combines terminal titles and progress indicators in one package. For this package, we wanted to split those concerns on purpose:

- progress updates should be usable on their own
- terminal title behavior should stay configurable elsewhere
- users should be able to combine this with their own title workflow or another title-focused extension

So `@claaslange/pi-progress-bar` only handles `OSC 9;4` progress signaling and intentionally leaves terminal titles untouched.

## Behavior

- 🔵 Indeterminate pulse while the agent is thinking or running tools
- 🟢 Green 100% completion flash when the agent finishes
- Clears the progress indicator on shutdown
- Does **not** modify the terminal title

## Install

From npm:

```bash
pi install npm:@claaslange/pi-progress-bar
```

From GitHub:

```bash
pi install git:github.com/claaslange/pi-progress-bar
```

From a local checkout:

```bash
pi install /absolute/path/to/pi-progress-bar
```

Or run it directly without installing:

```bash
pi -e /absolute/path/to/pi-progress-bar
```

## Compatibility and detection

This extension uses an optimistic runtime check before writing `OSC 9;4` sequences.

For local testing, you can force it on with:

```bash
PI_PROGRESS_BAR_FORCE=1 pi -e /absolute/path/to/pi-progress-bar
```

If you want to disable it even in a supported terminal, use:

```bash
PI_PROGRESS_BAR_DISABLE=1 pi -e /absolute/path/to/pi-progress-bar
```

At the moment that includes common terminal markers for Ghostty, WezTerm, iTerm, Windows Terminal, ConEmu, and tmux passthrough.

A good reference for terminal compatibility and detection is the tracking work in [jdx/mise#7485](https://github.com/jdx/mise/pull/7485).

## How it works

The extension listens to pi lifecycle events and writes `OSC 9;4` sequences directly to `/dev/tty`:

| Pi event | Action |
| --- | --- |
| `agent_start` | start indeterminate progress |
| `agent_end` | flash green 100% completion, then clear |
| `session_shutdown` | clear progress |

Because it writes directly to the terminal, it stays out of pi's normal TUI rendering.

## Package contents

This package exposes a single extension entrypoint at `./extensions/index.ts` through the `pi` manifest in `package.json`.

## License

MIT
