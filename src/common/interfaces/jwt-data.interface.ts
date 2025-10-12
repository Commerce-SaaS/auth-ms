export interface JwtData {
    jti:   string;
    sub:   string;
    email: string;
    role?: string;
    iat:   number;
    exp:   number;
}
