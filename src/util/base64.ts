export const toBase64 = (array: Uint8Array): string => {
  return Buffer.from(array).toString('base64');
};

export const fromBase64 = (base64: string): Uint8Array => {
  return new Uint8Array([...Buffer.from(base64, 'base64')]);
};
