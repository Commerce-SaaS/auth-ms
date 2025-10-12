export interface JwtPayload {
    jti: string;
    email: string;
    sub: string;
    role?: string;
}