declare type Optional<T> = T | undefined;
declare type MapType<T> = Partial<Record<string, T>>;
declare type NumMapType<T> = { [index: number]: T };
