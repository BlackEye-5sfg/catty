import { describe, expect, test } from "bun:test"
import { runComponentHandler } from "./component-handler"

describe("local component handler", () => {
	test("passes normalized data and forces safe ephemeral response", async () => {
		const command = [
			"/usr/bin/python3",
			"-c",
			"import json,sys; d=json.load(sys.stdin); print(json.dumps({'response': {'content': d['userId'], 'allowed_mentions': {'parse':['everyone']}, 'flags':32768}}))"
		]
		const body = await runComponentHandler(
			{ prefix: "ops:", command },
			{ userId: "test-admin" },
			process.cwd()
		)
		expect(body.content).toBe("test-admin")
		expect(body.flags).toBe(32832)
		expect(body.allowed_mentions.parse).toEqual([])
	})
	test("rejects malformed output", async () => {
		await expect(
			runComponentHandler(
				{
					prefix: "ops:",
					command: ["/usr/bin/python3", "-c", "print('not-json')"]
				},
				{},
				process.cwd()
			)
		).rejects.toThrow()
	})
	test("rejects unsuccessful handler", async () => {
		await expect(
			runComponentHandler(
				{
					prefix: "ops:",
					command: ["/usr/bin/python3", "-c", "raise SystemExit(1)"]
				},
				{},
				process.cwd()
			)
		).rejects.toThrow()
	})
	test("bounds output", async () => {
		await expect(
			runComponentHandler(
				{
					prefix: "ops:",
					command: ["/usr/bin/python3", "-c", "print('x'*40000)"]
				},
				{},
				process.cwd()
			)
		).rejects.toThrow()
	})
	test("bounds execution time", async () => {
		await expect(
			runComponentHandler(
				{
					prefix: "ops:",
					timeoutSeconds: 1,
					command: [
						"/usr/bin/python3",
						"-c",
						"import time;time.sleep(10)"
					]
				},
				{},
				process.cwd()
			)
		).rejects.toThrow()
	})
})
