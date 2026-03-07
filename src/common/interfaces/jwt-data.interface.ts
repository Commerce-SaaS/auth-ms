export interface JwtData {
    jti:   string;
    sub:   string;
    platformRole?: string;
    iat:   number;
    exp:   number;
}
