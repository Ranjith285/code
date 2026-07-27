import test from "node:test";
import assert from "node:assert/strict";
import { resolveComboContextLimit } from "../../open-sse/services/contextManager.ts";

test("#8769 resolveComboContextLimit handles array of combo target objects ({ name, models }) in comboTargetLimits", () => {
  const result = resolveComboContextLimit({
    provider: "unknown_provider",
    model: "unknown_model",
    comboTargetLimits: [
      { name: "subcombo1", models: [{ provider: "openai", model: "gpt-4" }] },
      { name: "subcombo2", models: [{ provider: "anthropic", model: "claude-3-5-sonnet" }] },
    ] as unknown as number[],
  });

  // Default fallback limit for unknown provider should be returned without throwing NaN or crash
  assert.equal(typeof result.limit, "number");
  assert.ok(!Number.isNaN(result.limit));
  assert.ok(result.limit > 0);
  assert.equal(result.source, "fallback");
});

test("#8769 resolveComboContextLimit filters numbers correctly when valid numbers are provided", () => {
  const result = resolveComboContextLimit({
    provider: "unknown_provider",
    model: "unknown_model",
    comboTargetLimits: [4000, 200000],
  });

  assert.equal(result.limit, 4000);
  assert.equal(result.source, "combo-min");
});
