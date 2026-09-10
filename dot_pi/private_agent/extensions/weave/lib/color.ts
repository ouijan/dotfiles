/**
 * Color references shared by weave modules: a pi theme token ("dim", "accent")
 * or a #rrggbb hex string rendered as raw truecolor ANSI.
 */

/** Theme surface weave needs (subset of pi's Theme; fg is bivariant). */
export interface EngineTheme {
	fg(color: string, text: string): string;
}

function hexToAnsi(hex: string, text: string): string {
	const red = parseInt(hex.slice(1, 3), 16);
	const green = parseInt(hex.slice(3, 5), 16);
	const blue = parseInt(hex.slice(5, 7), 16);
	return `\u001b[38;2;${red};${green};${blue}m${text}\u001b[39m`;
}

/** Resolve a color reference: #rrggbb → truecolor, token → theme, none → as-is. */
export function colorize(theme: EngineTheme, color: string | undefined, text: string): string {
	if (!color) return text;
	if (/^#[0-9a-fA-F]{6}$/.test(color)) return hexToAnsi(color, text);
	return theme.fg(color, text);
}
