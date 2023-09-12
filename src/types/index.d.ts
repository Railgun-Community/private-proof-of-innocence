declare type Optional<T> = T | undefined;
declare type MapType<T> = Partial<Record<string, T>>;
declare type NumMapType<T> = { [index: number]: T };

declare module 'bits-to-bytes';

declare module 'snarkjs';

declare module 'circomlibjs' {
  export function poseidon(inputs: bigint[]): bigint;
}
