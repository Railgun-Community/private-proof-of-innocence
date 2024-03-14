import { sha256 } from 'ethers';

export const sha256Hash = (data: object): string => {
  const stringified = JSON.stringify(data);
  const bytes = new TextEncoder().encode(stringified);
  return sha256(bytes);
};
