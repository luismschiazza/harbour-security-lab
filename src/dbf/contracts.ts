/** Domínio separado da API. Não há leitura ou escrita de DBFs implementada. */
export interface DbfCopyScope {
  readonly component: 'harbour-dbf';
  readonly datasetLabel: string;
  readonly copyDirectory: string;
  readonly fictitiousDataConfirmed: true;
  readonly consistentCopyConfirmed: true;
  readonly readOnly: true;
  readonly authorizationReference: string;
}

export type DbfReviewArea =
  | 'table-structure'
  | 'field-types'
  | 'character-encoding'
  | 'deleted-record-flags'
  | 'cdx-ntx-indexes'
  | 'fpt-dbt-memos'
  | 'access-permissions'
  | 'integrity-and-consistency';

export interface DbfReviewPlan {
  readonly scope: DbfCopyScope;
  readonly areas: readonly DbfReviewArea[];
  readonly includeRecordContentsInReports: false;
  /** Bibliotecas externas não demonstram a semântica nativa de bloqueio Harbour. */
  readonly nativeHarbourLockingVerified: false;
}
