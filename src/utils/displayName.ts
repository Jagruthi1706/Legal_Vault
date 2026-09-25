export const displayName = (name?: string | null, id?: string | null) =>
  name?.trim() ? name : 'User information unavailable';

export const isUuidLike = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
