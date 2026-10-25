export type IrisToolRisk = "low" | "medium" | "high";

export interface IrisToolPrincipal {
  readonly verified: true;
  readonly userId: string;
  readonly organizationId: string;
  readonly permissions: readonly string[];
  readonly stepUpAuthenticated?: boolean;
}

export interface IrisToolExecutionContext {
  readonly requestId: string;
  readonly principal?: IrisToolPrincipal | null;
  readonly confirmationToken?: string;
  readonly signal?: AbortSignal;
}

export interface IrisToolAuditEvent {
  readonly requestId: string;
  readonly actorId: string;
  readonly organizationId: string;
  readonly toolId: string;
  readonly risk: IrisToolRisk;
  readonly stage: "started" | "succeeded" | "failed";
  readonly confirmationUsed: boolean;
}

export interface IrisToolAuditSink {
  write(event: IrisToolAuditEvent): Promise<void>;
}

export interface IrisToolConfirmationRequest {
  readonly token: string;
  readonly requestId: string;
  readonly toolId: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly input: unknown;
}

export interface IrisToolConfirmationVerifier {
  /**
   * Must validate and consume a one-use approval bound to this actor, organization,
   * tool, and parsed input. The raw token must not be logged or persisted in audit.
   */
  consume(request: IrisToolConfirmationRequest): Promise<boolean>;
}

export interface IrisToolExecutionPrincipal {
  readonly userId: string;
  readonly organizationId: string;
  readonly signal?: AbortSignal;
}

export interface IrisTool<Input, Output> {
  readonly id: string;
  readonly description: string;
  readonly permission: string;
  readonly risk: IrisToolRisk;
  parse(input: unknown): Input;
  execute(input: Input, principal: IrisToolExecutionPrincipal): Output | Promise<Output>;
}

export interface IrisToolSummary {
  readonly id: string;
  readonly description: string;
  readonly permission: string;
  readonly risk: IrisToolRisk;
  readonly confirmationRequired: boolean;
  readonly stepUpAuthenticationRequired: boolean;
}

export type IrisToolInvocationErrorCode =
  | "tool_not_found"
  | "authentication_required"
  | "permission_denied"
  | "invalid_input"
  | "confirmation_required"
  | "step_up_authentication_required"
  | "audit_unavailable"
  | "execution_failed"
  | "audit_finalization_failed";

export type IrisToolInvocationResult<Output> =
  | { readonly ok: true; readonly value: Output }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: IrisToolInvocationErrorCode;
        readonly message: string;
        readonly executionMayHaveCompleted?: boolean;
      };
    };

export interface IrisToolRegistryOptions {
  readonly audit?: IrisToolAuditSink;
  readonly confirmations?: IrisToolConfirmationVerifier;
}

function isVerifiedPrincipal(principal: IrisToolPrincipal | null | undefined): principal is IrisToolPrincipal {
  return principal?.verified === true
    && typeof principal.userId === "string"
    && principal.userId.trim().length > 0
    && typeof principal.organizationId === "string"
    && principal.organizationId.trim().length > 0
    && Array.isArray(principal.permissions);
}

function errorResult<Output>(
  code: IrisToolInvocationErrorCode,
  message: string,
  executionMayHaveCompleted = false,
): IrisToolInvocationResult<Output> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(executionMayHaveCompleted ? { executionMayHaveCompleted: true } : {}),
    },
  };
}

export class IrisToolRegistry {
  private readonly tools = new Map<string, IrisTool<unknown, unknown>>();
  private readonly options: IrisToolRegistryOptions;

  constructor(options: IrisToolRegistryOptions = {}) {
    this.options = options;
  }

  register<Input, Output>(tool: IrisTool<Input, Output>): void {
    if (!tool.id.trim()) throw new Error("Uma ferramenta da IRIS precisa de um identificador.");
    if (!tool.description.trim()) throw new Error(`A ferramenta "${tool.id}" precisa de uma descrição.`);
    if (!tool.permission.trim()) throw new Error(`A ferramenta "${tool.id}" precisa de uma permissão.`);
    if (!["low", "medium", "high"].includes(tool.risk)) {
      throw new Error(`A ferramenta "${tool.id}" tem um nível de risco inválido.`);
    }
    if (this.tools.has(tool.id)) throw new Error(`A ferramenta "${tool.id}" já está registada.`);
    this.tools.set(tool.id, tool as IrisTool<unknown, unknown>);
  }

  list(): IrisToolSummary[] {
    return [...this.tools.values()].map((tool) => ({
      id: tool.id,
      description: tool.description,
      permission: tool.permission,
      risk: tool.risk,
      confirmationRequired: tool.risk !== "low",
      stepUpAuthenticationRequired: tool.risk === "high",
    }));
  }

  async invoke(
    id: string,
    input: unknown,
    context: IrisToolExecutionContext,
  ): Promise<IrisToolInvocationResult<unknown>> {
    const tool = this.tools.get(id);
    if (!tool) return errorResult("tool_not_found", "Esta ferramenta não está disponível.");

    const principal = context.principal;
    if (!isVerifiedPrincipal(principal)) {
      return errorResult("authentication_required", "É necessária uma identidade verificada.");
    }
    if (!principal.permissions.includes(tool.permission)) {
      return errorResult("permission_denied", "A identidade atual não tem permissão para esta ação.");
    }

    let parsedInput: unknown;
    try {
      parsedInput = tool.parse(input);
    } catch {
      return errorResult("invalid_input", "Os dados fornecidos à ferramenta não são válidos.");
    }

    if (tool.risk === "high" && principal.stepUpAuthenticated !== true) {
      return errorResult(
        "step_up_authentication_required",
        "Esta ação exige autenticação reforçada.",
      );
    }

    let confirmationUsed = false;
    if (tool.risk !== "low") {
      if (!context.confirmationToken || !this.options.confirmations) {
        return errorResult("confirmation_required", "Esta ação exige uma confirmação explícita.");
      }

      let confirmed = false;
      try {
        confirmed = await this.options.confirmations.consume({
          token: context.confirmationToken,
          requestId: context.requestId,
          toolId: tool.id,
          userId: principal.userId,
          organizationId: principal.organizationId,
          input: parsedInput,
        });
      } catch {
        return errorResult("confirmation_required", "Não foi possível validar a confirmação desta ação.");
      }
      if (!confirmed) {
        return errorResult("confirmation_required", "A confirmação não corresponde a esta ação.");
      }
      confirmationUsed = true;
    }

    if (!this.options.audit || !context.requestId.trim()) {
      return errorResult("audit_unavailable", "A auditoria não está disponível; a ação não foi executada.");
    }

    const auditBase = {
      requestId: context.requestId,
      actorId: principal.userId,
      organizationId: principal.organizationId,
      toolId: tool.id,
      risk: tool.risk,
      confirmationUsed,
    } as const;

    try {
      await this.options.audit.write({ ...auditBase, stage: "started" });
    } catch {
      return errorResult("audit_unavailable", "Não foi possível iniciar a auditoria; a ação não foi executada.");
    }

    let value: unknown;
    try {
      value = await tool.execute(parsedInput, {
        userId: principal.userId,
        organizationId: principal.organizationId,
        ...(context.signal ? { signal: context.signal } : {}),
      });
    } catch {
      try {
        await this.options.audit.write({ ...auditBase, stage: "failed" });
      } catch {
        // The original execution error remains primary; the external audit sink is unavailable.
      }
      return errorResult("execution_failed", "A ferramenta não conseguiu concluir a ação.");
    }

    try {
      await this.options.audit.write({ ...auditBase, stage: "succeeded" });
    } catch {
      return errorResult(
        "audit_finalization_failed",
        "A ação pode ter sido executada, mas não foi possível concluir o registo de auditoria.",
        true,
      );
    }

    return { ok: true, value };
  }
}
