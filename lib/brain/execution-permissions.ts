export type AstraExecutionPermissionResolution = {
  approvedPermissionLevel: 0 | 1 | 2 | 3 | 4;
  unattendedReadOnly: boolean;
};

export function resolveExecutionPermission({
  requireApproval,
  approved,
  requirePlan,
  permissionCeiling,
  hasApprovalToken,
}: {
  requireApproval: boolean;
  approved: boolean;
  requirePlan: boolean;
  permissionCeiling?: 0 | 1 | 2 | 3;
  hasApprovalToken: boolean;
}): AstraExecutionPermissionResolution {
  const unattendedReadOnly =
    requirePlan &&
    permissionCeiling !== undefined &&
    permissionCeiling <= 1 &&
    !hasApprovalToken;

  let approvedPermissionLevel: 0 | 1 | 2 | 3 | 4 =
    requireApproval ? (approved ? 2 : 1) : 2;

  if (permissionCeiling !== undefined) {
    approvedPermissionLevel = Math.min(
      approvedPermissionLevel,
      permissionCeiling,
    ) as 0 | 1 | 2 | 3 | 4;
  }

  return {
    approvedPermissionLevel,
    unattendedReadOnly,
  };
}
