import assert from "node:assert/strict";
import test from "node:test";
import { IrisToolRegistry } from "./irisToolRegistry.ts";

const principal = {
  verified: true,
  userId: "user-1",
  organizationId: "org-1",
  permissions: ["reports:read", "tasks:create", "payments:write"],
};

function makeTool({ id = "example.read", risk = "low", permission = "reports:read", execute = async () => "ok" } = {}) {
  return {
    id,
    description: "Ferramenta de teste.",
    permission,
    risk,
    parse(input) {
      if (!input || typeof input !== "object" || typeof input.value !== "string") {
        throw new Error("invalid input");
      }
      return { value: input.value.trim() };
    },
    execute,
  };
}

function makeAudit() {
  return {
    events: [],
    async write(event) {
      this.events.push(event);
    },
  };
}

function makeContext(overrides = {}) {
  return { requestId: "request-1", principal, ...overrides };
}

test("unregistered tools cannot be invoked", async () => {
  const registry = new IrisToolRegistry();
  const result = await registry.invoke("duvion.get_sales", {}, makeContext());

  assert.deepEqual(result, {
    ok: false,
    error: { code: "tool_not_found", message: "Esta ferramenta não está disponível." },
  });
});

test("invocation fails closed without a verified identity", async () => {
  let executed = false;
  const registry = new IrisToolRegistry();
  registry.register(makeTool({ execute: async () => { executed = true; } }));

  const result = await registry.invoke("example.read", { value: "x" }, makeContext({ principal: null }));

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "authentication_required");
  assert.equal(executed, false);
});

test("permission checks happen before execution", async () => {
  let executed = false;
  const registry = new IrisToolRegistry();
  registry.register(makeTool({
    permission: "finance:read",
    execute: async () => { executed = true; },
  }));

  const result = await registry.invoke("example.read", { value: "x" }, makeContext());

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "permission_denied");
  assert.equal(executed, false);
});

test("write tools require confirmation and audit before execution", async () => {
  const audit = makeAudit();
  let executed = false;
  const registry = new IrisToolRegistry({ audit });
  registry.register(makeTool({
    id: "tasks.create",
    risk: "medium",
    permission: "tasks:create",
    execute: async () => { executed = true; return "created"; },
  }));

  const result = await registry.invoke("tasks.create", { value: "Call customer" }, makeContext());

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "confirmation_required");
  assert.equal(executed, false);
  assert.equal(audit.events.length, 0);
});

test("a confirmed write consumes approval and records start and completion", async () => {
  const audit = makeAudit();
  const consumed = [];
  const registry = new IrisToolRegistry({
    audit,
    confirmations: {
      async consume(request) {
        consumed.push(request);
        return request.toolId === "tasks.create"
          && request.userId === principal.userId
          && request.organizationId === principal.organizationId
          && request.input.value === "Call customer";
      },
    },
  });
  registry.register(makeTool({
    id: "tasks.create",
    risk: "medium",
    permission: "tasks:create",
    execute: async (input) => input.value,
  }));

  const result = await registry.invoke(
    "tasks.create",
    { value: " Call customer " },
    makeContext({ confirmationToken: "opaque-one-use-approval" }),
  );

  assert.deepEqual(result, { ok: true, value: "Call customer" });
  assert.equal(consumed.length, 1);
  assert.deepEqual(audit.events.map((event) => event.stage), ["started", "succeeded"]);
  assert.ok(audit.events.every((event) => event.confirmationUsed));
  assert.equal("token" in audit.events[0], false);
});

test("high-risk tools require step-up authentication before consuming confirmation", async () => {
  let consumed = false;
  let executed = false;
  const registry = new IrisToolRegistry({
    audit: makeAudit(),
    confirmations: { async consume() { consumed = true; return true; } },
  });
  registry.register(makeTool({
    id: "payments.execute",
    risk: "high",
    permission: "payments:write",
    execute: async () => { executed = true; },
  }));

  const result = await registry.invoke(
    "payments.execute",
    { value: "transfer" },
    makeContext({ confirmationToken: "approval" }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "step_up_authentication_required");
  assert.equal(consumed, false);
  assert.equal(executed, false);
});

test("audit start failure prevents execution", async () => {
  let executed = false;
  const registry = new IrisToolRegistry({
    audit: { async write() { throw new Error("audit unavailable"); } },
  });
  registry.register(makeTool({ execute: async () => { executed = true; } }));

  const result = await registry.invoke("example.read", { value: "x" }, makeContext());

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "audit_unavailable");
  assert.equal(executed, false);
});

test("audit finalization failure reports that the action may have completed", async () => {
  let writeCount = 0;
  const registry = new IrisToolRegistry({
    audit: {
      async write() {
        writeCount += 1;
        if (writeCount === 2) throw new Error("audit unavailable");
      },
    },
  });
  registry.register(makeTool());

  const result = await registry.invoke("example.read", { value: "x" }, makeContext());

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "audit_finalization_failed");
    assert.equal(result.error.executionMayHaveCompleted, true);
  }
});
