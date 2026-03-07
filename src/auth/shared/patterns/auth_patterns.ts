export const AUTH_PATTERNS = {
  REGISTER_USER: 'auth.register_user',
  LOGIN: 'auth.login',
  REFRESH: 'auth.refresh',
  CHANGE_PASSWORD: 'auth.change_password',
  FORGOT_PASSWORD: 'auth.forgot_password',
  RESET_PASSWORD: 'auth.reset_password',
} as const;

export const MAILER_PATTERNS = {
  FORGOT_PASSWORD: 'forgot_password',
  VERIFY_EMAIL: 'verify_email',
} as const;

export const AUTHZ_PATTERNS = {
  USER_AUTHZ_REFRESH: 'userOrganization.user_authz_refresh'
} as const;

