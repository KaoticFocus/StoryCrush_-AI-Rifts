export interface CoordinateRekeyMovement {
  fromKey: string;
  toKey: string;
}

export interface TwoPhaseCoordinateRekeyPlan {
  sourceKeysToRemove: string[];
  destinationAssignments: Array<{ toKey: string; movementIndex: number }>;
}

export function planTwoPhaseCoordinateRekey(
  movements: readonly CoordinateRekeyMovement[],
): TwoPhaseCoordinateRekeyPlan {
  const sourceKeys = new Set<string>();
  const destinationKeys = new Set<string>();

  movements.forEach((movement) => {
    if (sourceKeys.has(movement.fromKey)) {
      throw new Error(`duplicate gravity source key: ${movement.fromKey}`);
    }
    if (destinationKeys.has(movement.toKey)) {
      throw new Error(`duplicate gravity destination key: ${movement.toKey}`);
    }
    sourceKeys.add(movement.fromKey);
    destinationKeys.add(movement.toKey);
  });

  return {
    sourceKeysToRemove: [...sourceKeys],
    destinationAssignments: movements.map((movement, movementIndex) => ({
      toKey: movement.toKey,
      movementIndex,
    })),
  };
}
