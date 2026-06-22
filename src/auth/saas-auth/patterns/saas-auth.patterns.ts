export const SAAS_AUTH_PATTERNS = {
  REGISTER: 'auth.saas.register',
  VERIFY_EMAIL: 'auth.saas.verify_email',
  RESEND_VERIFICATION: 'auth.saas.resend_verification',
  LOGIN: 'auth.saas.login',
  REFRESH: 'auth.saas.refresh',
  GOOGLE_AUTH: 'auth.google',
  CHANGE_EMAIL_REQUEST: 'saas.auth.change-email.request',
  CHANGE_EMAIL_CONFIRM: 'saas.auth.change-email.confirm',
  CHANGE_PASSWORD: 'auth.saas.change_password',
  FORGOT_PASSWORD: 'auth.saas.forgot_password',
  RESET_PASSWORD: 'auth.saas.reset_password',
} as const;

export const SAAS_MAILER_PATTERNS = {
  FORGOT_PASSWORD_SAAS: 'forgot_password.saas',
  VERIFY_EMAIL_SAAS: 'verify_email.saas',
  EMAIL_CHANGED_SAAS: 'saas_mailer_email_changed',
} as const;

export const AUTHZ_PATTERNS = {
  USER_AUTHZ_REFRESH: 'userOrganization.user_authz_refresh',
} as const;
