import type { Scope } from './scope.js';

export interface ConnectivityRequest {
  readonly scope: Scope;
  readonly host: string;
  readonly port: number;
  readonly connectTimeoutMs: number;
  readonly dnsTimeoutMs: number;
}

export type ConnectivityOutcome = 'connected' | 'refused' | 'timeout' | 'dns-error' | 'blocked' | 'network-error';

export interface TcpConnectionResult {
  readonly host: string;
  readonly resolvedAddress: string | null;
  readonly port: number;
  readonly outcome: ConnectivityOutcome;
  /** TCP connection establishment, NOT ICMP RTT or application latency. */
  readonly connectDurationMs: number | null;
  readonly dnsDurationMs: number | null;
  readonly errorCode: string | null;
}
