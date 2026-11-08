/** Random short id for new records (events, orders, pickups). Kept out of the domain on purpose. */
export const newId = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
