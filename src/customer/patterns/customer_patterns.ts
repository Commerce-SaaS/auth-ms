export const CUSTOMER_USER_PATTERNS = {
  CREATE: 'auth.customer.user.create',
  GET_PROFILE: 'auth.customer.user.get_profile',
  GET_ALL_PROFILES: 'auth.customer.user.get_all_profiles',
  UPDATE: 'auth.customer.user.update',
  DELETE: 'auth.customer.user.delete',
  SOFT_DELETE: 'auth.customer.user.soft-delete',
  RESTORE: 'auth.customer.user.restore',
  GET_PROFILE_BY_ADMIN: 'auth.customer.user.get_profile_by_admin',
  UPDATE_BY_ADMIN: 'auth.customer.user.update_by_admin',
  SOFT_DELETE_BY_ADMIN: 'auth.customer.user.soft-delete_by_admin',
  DELETE_BY_ADMIN: 'auth.customer.user.delete_by_admin',
  RESTORE_BY_ADMIN: 'auth.customer.user.restore_by_admin',
  // Fired after a customer is anonymized; consumed by orders-ms, payments-ms, organization-ms
  ANONYMIZED: 'customer.anonymized',
} as const;
