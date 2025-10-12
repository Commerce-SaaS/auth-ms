export interface SessionData {
  jti: string;
  ttl: number;
  data: UserData;
}

export interface UserData {
    userId: string;
    role?: string;
}
