/**
 * Remove the readonly flag from all properties in T
 */
export type Writable<T> = {
  -readonly [K in keyof T]: T[K];
};

/**
 * Get all keys in T whose value is of type K
 */
export type KeysByType<T, K> = {
  [P in keyof T as T[P] extends K ? P : never]: T[P];
};
