export enum PlatformRolesEnum {
  STAFF = 'staff',
  CUSTOMER = 'customer',
}

export enum TokenTypeEnum {
  ACCESS = 'access',
  REFRESH = 'refresh',
  RESET = 'reset',
  VERIFY_EMAIL = 'verifyEmail',
}

export interface JwtPayload {
  jti: string;
  sub: string;
  aud?: 'saas' | 'customer';
  type?: TokenTypeEnum;
  platformRole: PlatformRolesEnum;
}
