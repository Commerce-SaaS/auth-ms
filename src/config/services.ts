export const RMQ_SERVICE = 'RMQ_SERVICE';

export const AUTH_SERVICE = 'AUTH_SERVICE';
export const NOTIFICATIONS_EVENTS_CLIENT = 'NOTIFICATIONS_EVENTS_CLIENT';
export const AUTHZ_EVENTS_CLIENT = 'AUTHZ_EVENTS_CLIENT';
// Clients used to fan-out the customer.anonymized event to downstream services
export const ORDERS_EVENTS_CLIENT = 'ORDERS_EVENTS_CLIENT';
export const PAYMENTS_EVENTS_CLIENT = 'PAYMENTS_EVENTS_CLIENT';
// Organization lifecycle events queue (carries customer.anonymized, org updates, etc.)
export const ORGANIZATION_EVENTS_CLIENT = 'ORGANIZATION_EVENTS_CLIENT';
