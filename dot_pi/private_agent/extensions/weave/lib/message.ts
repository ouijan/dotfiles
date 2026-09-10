/** Reading streamed assistant messages without trusting their exact shape. */

interface ContentPart {
	type: string;
	text?: string;
}

interface MessageLike {
	role?: string;
	content?: ContentPart[];
}

function asAssistantMessage(message: unknown): MessageLike | undefined {
	const candidate = message as MessageLike | undefined;
	return candidate?.role === "assistant" ? candidate : undefined;
}

/** Prose the user can actually see — thinking and tool calls do not count. */
export function hasVisibleText(message: unknown): boolean {
	const assistant = asAssistantMessage(message);
	const content = assistant?.content ?? [];
	return content.some((part) => part.type === "text" && (part.text ?? "").trim().length > 0);
}
