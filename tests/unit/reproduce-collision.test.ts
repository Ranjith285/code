import test from "node:test";
import assert from "node:assert/strict";

const { createResponsesApiTransformStream } =
  await import("../../open-sse/transformer/responsesTransformer.ts");

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function runTransformStream(chunks) {
  const stream = createResponsesApiTransformStream(null, 3000, {});
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  const output = [];
  const readerTask = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      output.push(decoder.decode(value));
    }
  })();

  for (const chunk of chunks) {
    await writer.write(encoder.encode(chunk));
  }
  await writer.close();
  await readerTask;

  return output.join("");
}

function parseSseOutput(output) {
  return output
    .trim()
    .split("\n\n")
    .map((entry) => {
      const lines = entry.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event: "));
      const dataLine = lines.find((line) => line.startsWith("data: "));
      return {
        event: eventLine ? eventLine.slice("event: ".length) : null,
        data: dataLine ? dataLine.slice("data: ".length) : null,
      };
    });
}

test("createResponsesApiTransformStream: tool calls should not collide with message indices when reasoning is present", async () => {
  const output = await runTransformStream([
    'data: {"choices":[{"index":0,"delta":{"reasoning_content":"Thinking..."}}]}\n\n',
    'data: {"choices":[{"index":0,"delta":{"content":"Here is the result:"}}]}\n\n',
    'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"exec","arguments":"{}"}}]}}]}\n\n',
    'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
  ]);

  const events = parseSseOutput(output);

  const reasoningAdded = events.find(
    (e) => e.event === "response.output_item.added" && JSON.parse(e.data).item.type === "reasoning"
  );
  const messageAdded = events.find(
    (e) => e.event === "response.output_item.added" && JSON.parse(e.data).item.type === "message"
  );
  const toolCallAdded = events.find(
    (e) =>
      e.event === "response.output_item.added" && JSON.parse(e.data).item.type === "function_call"
  );

  assert.ok(reasoningAdded, "Reasoning item should be added");
  assert.ok(messageAdded, "Message item should be added");
  assert.ok(toolCallAdded, "Tool call item should be added");

  const reasoningIdx = JSON.parse(reasoningAdded.data).output_index;
  const messageIdx = JSON.parse(messageAdded.data).output_index;
  const toolCallIdx = JSON.parse(toolCallAdded.data).output_index;

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
