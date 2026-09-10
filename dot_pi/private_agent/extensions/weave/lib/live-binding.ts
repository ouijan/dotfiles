/**
 * The live binding behind weave's prototype patches.
 *
 * Both UI patches (tools/rows.ts, tools/thinking.ts) install a function on a
 * class prototype pi and weave share. That patch is process-global and installed
 * exactly once, but the extension instance that installed it is not permanent:
 * `/new`, `/resume`, `/fork` and `/reload` tear the old instance down and bind a
 * fresh one. The installed closure kept pointing at the dead instance — and at
 * its dead `ExtensionContext`, whose `ctx.ui` throws
 * "This extension ctx is stale after session replacement or reload". Render runs
 * on a timer, so that throw arrived as an uncaughtException and took pi down.
 *
 * The patch therefore holds no state of its own. It reads whatever the newest
 * instance last published here, and every instance publishes at load. The slot
 * lives on `globalThis` rather than in module scope because a reload may hand
 * the new instance a fresh copy of these modules: module-level state would be
 * per-copy, and the patch would still read the dead one's.
 */

interface WeaveGlobals {
	weaveRowGrouping?: unknown;
	weaveThinkingShouldHide?: unknown;
}

type Slot = keyof WeaveGlobals;

function slots(): WeaveGlobals {
	return globalThis as typeof globalThis & WeaveGlobals;
}

/** Publish this instance's binding, replacing any previous instance's. */
export function publish<T>(slot: Slot, value: T | undefined): void {
	slots()[slot] = value;
}

/** Read the newest published binding, or undefined when weave is disabled. */
export function live<T>(slot: Slot): T | undefined {
	return slots()[slot] as T | undefined;
}
