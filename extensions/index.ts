import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { writeFileSync } from "node:fs";

const CLEAR_PROGRESS_SEQUENCE = "\x1b]9;4;0\x07";
const INDETERMINATE_PROGRESS_SEQUENCE = "\x1b]9;4;3\x07";
const COMPLETE_PROGRESS_SEQUENCE = "\x1b]9;4;1;100\x07";
const COMPLETION_FLASH_MS = 800;

const OSC_94_TERM_PROGRAMS = new Set(["ghostty", "wezterm", "iterm.app"]);

type ProgressTransport = "direct" | "tmux";

let clearTimer: ReturnType<typeof setTimeout> | undefined;

function supportsOsc94Terminal(): boolean {
	const termProgram = process.env.TERM_PROGRAM?.toLowerCase();
	const term = process.env.TERM?.toLowerCase();

	if (termProgram && OSC_94_TERM_PROGRAMS.has(termProgram)) return true;
	if (process.env.WT_SESSION) return true;
	if (process.env.ConEmuPID) return true;
	if (term?.includes("ghostty")) return true;
	if (term?.includes("wezterm")) return true;
	if (term?.includes("iterm")) return true;

	return false;
}

function getProgressTransport(): ProgressTransport | undefined {
	if (process.env.PI_PROGRESS_BAR_DISABLE === "1") return undefined;

	if (process.env.PI_PROGRESS_BAR_FORCE === "1") {
		return process.env.TMUX ? "tmux" : "direct";
	}

	if (!supportsOsc94Terminal()) return undefined;
	return process.env.TMUX ? "tmux" : "direct";
}

function wrapForTmux(sequence: string): string {
	return `\x1bPtmux;${sequence.replace(/\x1b/g, "\x1b\x1b")}\x1b\\`;
}

function writeToTerminal(sequence: string): void {
	const transport = getProgressTransport();
	if (!transport) return;

	const output = transport === "tmux" ? wrapForTmux(sequence) : sequence;

	try {
		writeFileSync("/dev/tty", output);
	} catch {
		// Ignore environments without a controlling TTY.
	}
}

function clearPendingTimer(): void {
	if (!clearTimer) return;
	clearTimeout(clearTimer);
	clearTimer = undefined;
}

function startIndeterminateProgress(): void {
	clearPendingTimer();
	writeToTerminal(INDETERMINATE_PROGRESS_SEQUENCE);
}

function flashCompletion(): void {
	clearPendingTimer();
	writeToTerminal(COMPLETE_PROGRESS_SEQUENCE);
	clearTimer = setTimeout(() => {
		writeToTerminal(CLEAR_PROGRESS_SEQUENCE);
		clearTimer = undefined;
	}, COMPLETION_FLASH_MS);
}

function clearProgress(): void {
	clearPendingTimer();
	writeToTerminal(CLEAR_PROGRESS_SEQUENCE);
}

export default function progressBarExtension(pi: ExtensionAPI) {
	pi.on("agent_start", async () => {
		startIndeterminateProgress();
	});

	pi.on("agent_end", async () => {
		flashCompletion();
	});

	pi.on("session_shutdown", async () => {
		clearProgress();
	});
}
