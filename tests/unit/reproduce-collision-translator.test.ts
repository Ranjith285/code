import test from "node:test";
import assert from "node:assert/strict";

const { openaiToOpenAIResponsesResponse } =
  await import("../../open-sse/translator/response/openai-responses.ts");
const { initState } = await import("../../open-sse/translator/index.ts");
const { FORMATS } = await import("../../open-sse/translator/formats.ts");

test("openaiToOpenAIResponsesResponse: tool calls should not collide with message indices when reasoning is present", () => {
  const state = initState(FORMATS.OPENAI_RESPONSES);

  const chunks = [
    { choices: [{ index: 0, delta: { reasoning_content: "Thinking..." } }] },
    { choices: [{ index: 0, delta: { content: "Here is the result:" } }] },
    {
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [{ index: 0, id: "call_1", function: { name: "exec", arguments: "{}" } }],
          },
        },
      ],
    },
    { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
  ];

  const allEvents = [];
  for (const chunk of chunks) {
    const events = openaiToOpenAIResponsesResponse(chunk, state);
    allEvents.push(...events);
  }

  const reasoningAdded = allEvents.find(
    (e) => e.event === "response.output_item.added" && e.data.item.type === "reasoning"
  );
  const messageAdded = allEvents.find(
    (e) => e.event === "response.output_item.added" && e.data.item.type === "message"
  );
  const toolCallAdded = allEvents.find(
    (e) => e.event === "response.output_item.added" && e.data.item.type === "function_call"
  );

  assert.ok(reasoningAdded, "Reasoning item should be added");
  assert.ok(messageAdded, "Message item should be added");
  assert.ok(toolCallAdded, "Tool call item should be added");

  const reasoningIdx = reasoningAdded.data.output_index;
  const messageIdx = messageAdded.data.output_index;
  const toolCallIdx = toolCallAdded.data.output_index;

  console.log(
    `Indices - Reasoning: ${reasoningIdx}, Message: ${messageIdx}, Tool Call: ${toolCallIdx}`
  );

  assert.notEqual(reasoningIdx, messageIdx, "Reasoning and Message should have different indices");
  assert.notEqual(
    reasoningIdx,
    toolCallIdx,
    "Reasoning and Tool Call should have different indices"
  );
  assert.notEqual(messageIdx, toolCallIdx, "Message and Tool Call should have different indices");

  assert.equal(reasoningIdx, 0);
  assert.equal(messageIdx, 1);
  assert.equal(toolCallIdx, 2);
});
