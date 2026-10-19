// Trusted local handlers receive normalized gateway metadata, never interaction tokens.
export type ComponentHandler = {
	prefix: string
	command: string[]
	timeoutSeconds?: number
}

export async function runComponentHandler(
	handler: ComponentHandler,
	input: Record<string, string>,
	workspace: string
) {
	if (!handler.command.length)
		throw new Error("Empty component handler command")
	const process = Bun.spawn(handler.command, {
		cwd: workspace,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "ignore"
	})
	const timeout = setTimeout(
		() => process.kill("SIGKILL"),
		Math.min(900, Math.max(1, handler.timeoutSeconds ?? 300)) * 1000
	)
	try {
		process.stdin.write(JSON.stringify(input))
		process.stdin.end()
		const reader = process.stdout.getReader()
		const chunks: Uint8Array[] = []
		let bytes = 0
		while (true) {
			const next = await reader.read()
			if (next.done) break
			bytes += next.value.length
			if (bytes > 32768) {
				process.kill("SIGKILL")
				throw new Error("Component handler response too large")
			}
			chunks.push(next.value)
		}
		if ((await process.exited) !== 0)
			throw new Error("Component handler failed")
		const result = JSON.parse(Buffer.concat(chunks).toString("utf8"))
		if (!result || typeof result.response !== "object" || !result.response)
			throw new Error("Invalid component handler response")
		const response = result.response as {
			content?: string
			components?: unknown[]
			flags?: number
		}
		// Do not allow child-controlled mentions, attachments or webhook routing.
		return {
			content: response.content ?? "",
			components: response.components ?? [],
			flags: 64 | ((response.flags ?? 0) & 32768),
			allowed_mentions: { parse: [] }
		}
	} finally {
		clearTimeout(timeout)
		if (process.exitCode === null) process.kill("SIGKILL")
	}
}
