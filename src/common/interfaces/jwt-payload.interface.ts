import { PlatformRolesEnum } from "src/auth/shared/enums/platform-roles.enum";

export interface JwtPayload {
    jti: string;
    sub: string;
    type?: 'access' | 'refresh' | 'reset';
    platformRole: PlatformRolesEnum;
}