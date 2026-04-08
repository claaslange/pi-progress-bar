import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { writeFileSync } from "node:fs";

const CLEAR_PROGRESS_SEQUENCE = "\x1b]9;4;0\x07";
const INDETERMINATE_PROGRESS_SEQUENCE = "\x1b]9;4;3\x07";
const ERROR_PROGRESS_SEQUENCE = "\x1b]9;4;2\x07";
const COMPLETE_PROGRESS_SEQUENCE = "\x1b]9;4;1;100\x07";
const COMPLETION_FLASH_MS = 800;

const OSC_94_TERM_PROGRAMS = new Set(["ghostty", "wezterm", "iterm.app"]);

type ProgressTransport = "direct" | "tmux";

let clearTimer: ReturnType<typeof setTimeout> | undefined;
let agentRunning = false;
let errorActive = false;
let handledToolCompletions = new Set<string>();

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

function showErrorProgress(): void {
	clearPendingTimer();
	writeToTerminal(ERROR_PROGRESS_SEQUENCE);
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

function updateErrorState(isError: boolean): void {
	if (isError) {
		errorActive = true;
		showErrorProgress();
		return;
	}

	if (!errorActive) return;

	errorActive = false;
	if (agentRunning) startIndeterminateProgress();
	else clearProgress();
}

function handleToolCompletion(toolCallId: string, isError: boolean): void {
	if (handledToolCompletions.has(toolCallId)) return;
	handledToolCompletions.add(toolCallId);
	updateErrorState(isError);
}

export default function progressBarExtension(pi: ExtensionAPI) {
	pi.on("agent_start", async () => {
		agentRunning = true;
		errorActive = false;
		handledToolCompletions = new Set();
		startIndeterminateProgress();
	});

	pi.on("tool_execution_end", async (event) => {
		handleToolCompletion(event.toolCallId, event.isError);
	});

	pi.on("tool_result", async (event) => {
		handleToolCompletion(event.toolCallId, event.isError);
	});

	pi.on("agent_end", async () => {
		agentRunning = false;
		handledToolCompletions = new Set();
		if (errorActive) clearProgress();
		else flashCompletion();
	});

	pi.on("session_shutdown", async () => {
		agentRunning = false;
		errorActive = false;
		handledToolCompletions = new Set();
		clearProgress();
	});
}
