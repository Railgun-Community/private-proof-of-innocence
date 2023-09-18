import { SnarkProof } from '../models/proof-types';
import { groth16 } from 'snarkjs';

export const verifySnarkProof = async (
  vkey: object,
  publicSignals: string[],
  snarkProof: SnarkProof,
): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await groth16.verify(vkey, publicSignals, snarkProof);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(`Error verifying snark proof: ${err.message}`);
  }
};
