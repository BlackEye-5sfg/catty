// Local compiled-only regression probe for GENERAL-44. Never loads Catty config,
// Discord, model credentials, the workspace, jobs or a real MCP server.
import assert from "node:assert/strict"
import "./codemode-runtime"
import {
	getCodemodeWorkerSpecifier,
	getQuickJSWasmPath
} from "../node_modules/@earendil-works/pi-coding-agent/dist/config.js"
import { executeCodemode } from "../node_modules/@earendil-works/pi-coding-agent/dist/extensions/codemode/execute.js"
import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent"

assert.ok(getQuickJSWasmPath().startsWith("/$bunfs/"), "WASM must come from the compiled executable")
assert.equal(getCodemodeWorkerSpecifier(), "./src/extensions/codemode/worker.ts")
let calls = 0
const context = {
	tools: [{
		name: "test_echo",
		description: "Echo a synthetic probe value without external access.",
		parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"] }
	}],
	sessionManager: { getBranch: () => [] },
	executeTool: async (name: string, args: unknown) => {
		assert.equal(name, "test_echo")
		assert.deepEqual(args, { value: "compiled-ok" })
		calls++
		return {
			toolCall: { id: "synthetic/1" },
			isError: false,
			result: { content: [{ type: "text", text: "compiled-ok" }], details: {} }
		}
	}
} as unknown as ExtensionToolContext
const result = await executeCodemode("compiled-smoke", {
	code: `const found = await searchTools("echo");
if (!found.length) throw new Error("Discovery failed");
const output = await tools.test_echo({value:"compiled-ok"});
if (typeof process !== "undefined" || typeof fetch !== "undefined") throw new Error("Unexpected host capability");
text(output);
return 6 * 7;`
}, undefined, undefined, context)
assert.ok(!("isError" in result && result.isError), "Compiled Codemode execution failed")
const text = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n")
assert.ok(text.includes("compiled-ok"))
assert.ok(text.includes("42"))
assert.equal(calls, 1)
console.log("PASS: embedded WASM, bundled worker, SDK Codemode, discovery, synthetic nested tool, arithmetic and sandbox host isolation")
