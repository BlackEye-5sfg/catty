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
