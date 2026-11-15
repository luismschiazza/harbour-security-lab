import type { AuthorizedTarget, EvidenceRecord } from '../reporting/contracts.js';

/** API de integração somente; resultados não comprovam falhas do Harbour. */
export type ApiTestKind =
  | 'http-availability'
  | 'missing-authentication'
  | 'invalid-credentials'
  | 'valid-credentials'
  | 'malformed-request'
  | 'invalid-parameters'
  | 'response-size-limit'
  | 'timeout-handling'
  | 'dbf-exposure';

export interface ApiAuditPlan {
  readonly component: 'integration-api';
  readonly target: AuthorizedTarget;
  /** Caminhos exatos, expressamente aprovados; não enumerar arquivos ou rotas. */
  readonly approvedPaths: readonly string[];
  readonly tests: readonly ApiTestKind[];
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly followRedirects: false;
}

export interface ApiAuditor {
  /** Future Checkpoint 5 suite; http.ts currently implements bounded GET checks only. */
  audit(plan: ApiAuditPlan): Promise<readonly EvidenceRecord[]>;
}
