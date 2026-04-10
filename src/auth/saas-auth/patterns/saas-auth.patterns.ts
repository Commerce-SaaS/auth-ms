export const SAAS_AUTH_PATTERNS = {
  REGISTER: 'auth.saas.register',
  LOGIN: 'auth.saas.login',
  GOOGLE_AUTH: 'auth.google',
  REFRESH: 'auth.saas.refresh',
  CHANGE_PASSWORD: 'auth.saas.change_password',
  FORGOT_PASSWORD: 'auth.saas.forgot_password',
  RESET_PASSWORD: 'auth.saas.reset_password',
} as const;

export const SAAS_MAILER_PATTERNS = {
  FORGOT_PASSWORD: 'forgot_password',
  VERIFY_EMAIL: 'verify_email',
} as const;

export const AUTHZ_PATTERNS = {
  USER_AUTHZ_REFRESH: 'userOrganization.user_authz_refresh'
} as const;

