export const CUSTOMER_AUTH_PATTERNS = {
  REGISTER: 'auth.customer.register',
  LOGIN: 'auth.customer.login',
  REFRESH: 'auth.customer.refresh',
  CHANGE_PASSWORD: 'auth.customer.change_password',
  FORGOT_PASSWORD: 'auth.customer.forgot_password',
  RESET_PASSWORD: 'auth.customer.reset_password',
} as const;

export const CUSTOMER_MAILER_PATTERNS = {
  FORGOT_PASSWORD: 'forgot_password',
  VERIFY_EMAIL: 'verify_email',
} as const;

export const AUTHZ_PATTERNS = {
  USER_AUTHZ_REFRESH: 'userOrganization.user_authz_refresh'
} as const;


