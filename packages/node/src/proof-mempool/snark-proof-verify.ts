import { SnarkProof } from '../models/proof-types';
import { groth16 } from 'snarkjs';

export const verifySnarkProof = (
  vkey: object,
  publicSignals: string[],
  snarkProof: SnarkProof,
): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return groth16.verify(vkey, publicSignals, snarkProof);
};
