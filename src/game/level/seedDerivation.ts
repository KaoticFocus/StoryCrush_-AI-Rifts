import { BoardDomainError } from '../board/errors';
import { LevelSeedPurpose } from './levelTypes';

const PURPOSE_SALT: Record<LevelSeedPurpose, number> = {
  'move-resolution': 0x9e3779b1,
  'post-move-reshuffle': 0x85ebca6b,
  'initial-reshuffle': 0xc2b2ae35,
};

function mixUint32(value: number): number {
  let v = value >>> 0;
  v ^= v >>> 16;
  v = Math.imul(v, 0x7feb352d) >>> 0;
  v ^= v >>> 15;
  v = Math.imul(v, 0x846ca68b) >>> 0;
  v ^= v >>> 16;
  return v >>> 0;
}

export function deriveLevelSeed(input: {
  baseSeed: number;
  acceptedMoveIndex: number;
  purpose: LevelSeedPurpose;
}): number {
  if (!Number.isInteger(input.baseSeed)) {
    throw new BoardDomainError('invalid-derived-seed', 'baseSeed must be an integer');
  }

  if (!Number.isSafeInteger(input.acceptedMoveIndex) || input.acceptedMoveIndex < 0) {
    throw new BoardDomainError(
      'invalid-derived-seed',
      `acceptedMoveIndex must be a non-negative safe integer; received ${String(input.acceptedMoveIndex)}`,
    );
  }

  const salted = (input.baseSeed >>> 0) ^ PURPOSE_SALT[input.purpose];
  const mixed = mixUint32(salted ^ Math.imul((input.acceptedMoveIndex + 1) >>> 0, 0x27d4eb2d));

  return mixed;
}
