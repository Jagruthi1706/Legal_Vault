import type { User, UserRole } from '../types';

export type Permission =
  | 'viewCases'
  | 'uploadEvidence'
  | 'anchorCustody'
  | 'officialVerify'
  | 'tamperCheck'
  | 'manageUsers';

const permissions: Record<UserRole, readonly Permission[]> = {
  client: ['viewCases', 'uploadEvidence'],
  lawyer: ['viewCases', 'uploadEvidence', 'anchorCustody'],
  judge: ['viewCases', 'officialVerify', 'tamperCheck'],
  admin: ['viewCases', 'manageUsers'],
  invalid: [],
};

/** UI-only capability check. The backend remains the authorization boundary. */
export const can = (user: Pick<User, 'role'> | null | undefined, permission: Permission): boolean =>
  Boolean(user && permissions[user.role].includes(permission));

export const hasRole = (
  user: Pick<User, 'role'> | null | undefined,
  ...roles: Exclude<UserRole, 'invalid'>[]
): boolean => Boolean(user && roles.includes(user.role as Exclude<UserRole, 'invalid'>));

export interface EvidenceWorkflowVisibility {
  uploadEvidence: boolean;
  anchorCustody: boolean;
  officialVerify: boolean;
  tamperDetection: boolean;
}

export const getEvidenceWorkflowVisibility = (
  user: Pick<User, 'role'> | null | undefined,
): EvidenceWorkflowVisibility => ({
  uploadEvidence: can(user, 'uploadEvidence'),
  anchorCustody: can(user, 'anchorCustody'),
  officialVerify: can(user, 'officialVerify'),
  tamperDetection: can(user, 'tamperCheck'),
});
