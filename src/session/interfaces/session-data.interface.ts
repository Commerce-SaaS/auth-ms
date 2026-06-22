export interface ClientInfo {
  userAgent?: string;
  ip?: string;
  deviceName?: string;
}

export interface SessionData {
  jti: string;
  ttl: number;
  data: { userId: string };
  clientInfo?: ClientInfo;
  createdAt?: string;
}