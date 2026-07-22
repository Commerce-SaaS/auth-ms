export interface JwtData {
    jti:   string;
    sub:   string;
    aud?: 'saas' | 'customer';
    platformRole?: string;
    iat:   number;
    exp:   number;
}
