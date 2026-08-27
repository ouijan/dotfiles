/** Shared agent streaming state, fed by agent_start/agent_end events. */
export class AgentActivity {
	working = false;
	startedAt?: number;
	private listeners = new Set<() => void>();

	start(): void {
		this.working = true;
		this.startedAt = Date.now();
		this.notify();
	}

	stop(): void {
		this.working = false;
		this.startedAt = undefined;
		this.notify();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
