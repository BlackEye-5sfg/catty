# Deterministic local component handlers

An optional trusted-config handler can claim a custom-ID prefix before component interactions enter the model queue. Existing Discord authorization still runs first. Handled interactions are deferred ephemerally; the child response edits that original response instead of leaving a thinking message or posting separately. Handler failure never falls through to the model.

```toml
[[componentHandlers]]
prefix = "ops:"
command = ["/usr/bin/python3", "scripts/ops_dispatch.py"]
timeoutSeconds = 600
```

Commands run without a shell in the configured workspace. Configure only trusted local executables. The program receives one JSON object on stdin with `interactionId`, `userId`, `guildId`, `channelId`, `messageId`, `messageAuthorId`, and `customId`. These originate from the gateway interaction, not model-generated arguments. No interaction token or entire raw Discord payload is sent to the child. Inherited process environment may still contain runtime secrets; this is not a sandbox.

Return JSON on stdout:

```json
{"response":{"flags":32768,"components":[{"type":10,"content":"Confirmation or result"}]}}
```

A plain `response.content` is also supported. The bridge forces ephemeral responses, disables mention parsing, and discards arbitrary response fields. Components V2 flags are retained. Children are responsible for valid Discord component layouts and must authenticate authorization/intent independently if actions are privileged. Never turn arbitrary custom-ID text into a shell command.

Child output is limited to 32 KiB. Timeouts default to 300 seconds, clamp to 1–900 seconds, and kill the direct child. Stderr is discarded to prevent private execution details leaking into harness logs. Killing the child does not guarantee any external operation stopped: a side-effecting handler must persist a consumed/running state BEFORE acting and must treat interruptions as uncertain, not safe to retry. Exactly-once external execution cannot be guaranteed by a UI handler alone.

Handlers are matched in order; first nonempty matching prefix wins. Missing handler configuration preserves existing model routing. Configuration is loaded on Catty startup; restart to activate changes. This is opt-in and grants no permissions by itself.

## Local v0.6.1 compatibility checks

The local dispatcher patch applies to v0.6.1 without changing its authorization,
normalized metadata or fail-closed branch. Upstream's deferred-response changes
apply to the ordinary model-routed component path; claimed local handlers still
complete their own ephemeral response and return before that path.

Build v0.6.1 with **both** entrypoints, as in its release scripts. The worker is
not optional; a successful single-entrypoint compile does not prove Codemode works.

```sh
bun test
bun run typecheck
bun build src/index.ts ./src/extensions/codemode/worker.ts --compile \
  --outfile /private/staging/catty --external '@node-llama-cpp/*'
bun build src/codemode-runtime.smoke.ts ./src/extensions/codemode/worker.ts --compile \
  --outfile /private/staging/codemode-smoke --external '@node-llama-cpp/*'
(cd /tmp && /private/staging/codemode-smoke)
/private/staging/catty help
```

The smoke program uses the real SDK Codemode executor with synthetic tools and
no Discord/model/MCP credentials or Catty configuration. It asserts that WASM is
embedded, the compiled worker starts, discovery and one nested tool call work,
and host `process`/`fetch` are not exposed to the sandbox. It does not prove live
gateway readiness or real MCP operation after deployment. Do not use `--version`
as a smoke flag: this release does not implement it and unknown flags can start
Catty. Compile/test success is not activation permission; preserve the current
binary and obtain explicit approval before replacement/restart.
