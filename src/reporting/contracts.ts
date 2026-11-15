/** Evidence contracts; exports are sanitized defensively in evidence.ts. */
export type AuditComponent = 'environment' | 'connectivity' | 'integration-api' | 'harbour-dbf';
export type EvidenceStatus = 'pass' | 'fail' | 'error' | 'blocked' | 'not-run';

export interface AuthorizedTarget {
  /** Referência pseudonimizada, sem tokens, caminhos privados ou credenciais. */
  readonly label: string;
  readonly host: string;
  readonly ports: readonly number[];
  readonly authorizationReference: string;
}

export interface SafeError {
  readonly code: string;
  /** Somente mensagem sanitizada, sem stack, URL, cabeçalhos ou corpo remoto. */
  readonly message: string;
}

export interface EvidenceRecord {
  readonly schemaVersion: '1.0';
  readonly runId: string;
  readonly testId: string;
  readonly component: AuditComponent;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly executorMachine: string;
  /** null para diagnóstico local, sem alvo remoto autorizado. */
  readonly authorizedTarget: AuthorizedTarget | null;
  readonly objective: string;
  readonly expectedResult: string;
  readonly observedResult: string;
  readonly status: EvidenceStatus;
  /** null quando a duração não foi medida; nunca inventar uma medição. */
  readonly durationMs: number | null;
  readonly errors: readonly SafeError[];
  /** Optional bounded structured metadata; sanitized with the rest of the record. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}
