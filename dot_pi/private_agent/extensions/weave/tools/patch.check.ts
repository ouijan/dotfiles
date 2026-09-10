/**
 * Regression guard for the crash where `/new` exited pi:
 *
 *   npx tsx weave/tools/patch.check.ts
 *
 * The prototype patches outlive the extension instance that installed them. The
 * first instance's `getTheme` closed over an `ExtensionContext` that `/new`
 * invalidates, and reading `ctx.ui` on it throws "This extension ctx is stale
 * after session replacement or reload". Render is timer-driven, so the throw
 * escaped as an uncaughtException.
 *
 * Two properties are asserted here: a throwing binding degrades to pi's own row
 * instead of propagating, and a second instance's binding replaces the first's.
 *
 * Not an extension entry point; pi only loads top-level extension modules.
 */
import { installRowGrouping, type PatchableProto } from "./rows-patch.ts";
import { ToolGroups } from "./groups.ts";
import { loadWeaveConfig } from "../config.ts";

const config = { ...loadWeaveConfig().tools, enabled: true, minimize: true };
// Stand-in for pi's ToolExecutionComponent.prototype: outside a running pi the
// real class has no runtime entry point, and the patch never needed more of it.
let originalCalls = 0;
const proto: PatchableProto = {
	render: function stubRender(): string[] {
		originalCalls += 1;
		return ["pi row"];
	},
};

const row = {
	toolName: "read",
	toolCallId: "call-1",
	expanded: false,
	isPartial: false,
	invalidate: () => {},
};

function render(): string[] {
	return (proto.render as (this: unknown, width: number) => string[]).call(row, 80);
}

function fail(message: string): never {
	console.error(`FAIL: ${message}`);
	process.exit(1);
}

// Instance one, holding a ctx that a later /new invalidates.
let ctxAlive = true;
installRowGrouping(proto, {
	config,
	groups: new ToolGroups(true),
	getTheme: () => {
		if (!ctxAlive) throw new Error("This extension ctx is stale after session replacement or reload.");
		return undefined;
	},
});
render();

ctxAlive = false;
const before = originalCalls;
let staleLines: string[];
try {
	staleLines = render();
} catch (error) {
	fail(`stale binding escaped the patch: ${(error as Error).message}`);
}
if (originalCalls !== before + 1) fail("stale binding did not fall back to pi's own row");
if (staleLines.join("") !== "pi row") fail(`unexpected fallback output: ${JSON.stringify(staleLines)}`);

// Instance two takes over: the once-installed patch must read the new binding.
let replacementAsked = false;
installRowGrouping(proto, {
	config,
	groups: new ToolGroups(true),
	getTheme: () => {
		replacementAsked = true;
		return undefined;
	},
});
render();
if (!replacementAsked) fail("patch kept using the replaced instance's binding");

// A load with grouping off must not leave the previous binding driving rows.
installRowGrouping(proto, { config: { ...config, enabled: false }, groups: new ToolGroups(true), getTheme: () => fail("disabled instance still consulted") });
render();

console.log("ALL OK");
