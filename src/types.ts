export interface CancellationToken {
    readonly isCancelled: boolean;
    cancel(): void;
    compensation(fn: Compensation): void;
}


export type Handler<I = void, O = any> =
    (input: I, token: CancellationToken) => Promise<O>;

export type Middleware<I = any, O = any, NextI = I, NextO = O> =
    (input: I,
        next: (input: NextI) => Promise<NextO>,
        token: CancellationToken
    ) => Promise<O>;

export type HandlerFactory =
    (procedureName: string) => Handler<any, any>;

export type Compensation = () => Promise<void> | void;


export type RegisterBuilder<T extends Record<string, any>, Name extends string, I, O> = {
    using(factory: HandlerFactory): ContainerInstance<T & { [K in Name]: { input: I; output: O } }, true>;
    middleware(mw: Middleware<I, O>): RegisterBuilder<T, Name, I, O>;
} & ContainerInstance<T & { [K in Name]: { input: I; output: O } }, true>;

export type ContainerInstance<T extends Record<string, any>, HasDefault extends boolean = false> = {
    /** @internal Phantom type carrier for generic inference — do not use at runtime */
    readonly __$type: T;
    using(factory: HandlerFactory): ContainerInstance<T, true>;
    execute<K extends keyof T>(
        name: K,
        input?: T[K]['input']
    ): Promise<T[K]['output']>;
    execute<I = any, O = any>(
        name: string,
        input?: I
    ): Promise<O>;
} & (HasDefault extends true ? {
    register<Name extends string>(name: Name): RegisterBuilder<T, Name, any, any>;
    register<I, O>(name: string): RegisterBuilder<T, string, I, O>
} : {});

export type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
    ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
    : S;

export type CamelCaseAdapterMethods<T extends Record<string, any>> = {
    [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: (input?: T[K]['input']) => Promise<T[K]['output']>;
};


// ── CamelCaseTypedContainer (jscriptify) ────────────────────────────

export type CamelCaseTypedContainer<T extends Record<string, any>, HasDefault extends boolean = false> = {
    readonly __$type: T;
    middleware(mw: Middleware<any, any>): CamelCaseTypedContainer<T, HasDefault>;
    using(factory: HandlerFactory): CamelCaseTypedContainer<T, true>;
} & (HasDefault extends true ? CamelCaseAdapterMethods<T> & {
    register<Name extends string>(name: Name): CamelCaseRegisterBuilderWithTypes<T, Name, any, any, true>;
    register<I, O>(name: string): CamelCaseRegisterBuilderWithTypes<T, string, I, O, true>;
    execute<K extends keyof T>(
        name: K,
        input?: T[K]['input']
    ): Promise<T[K]['output']>;
    execute<I = any, O = any>(
        name: string,
        input?: I
    ): Promise<O>;
} : {});

// ── Register builder types ──────────────────────────────────────────

export type RegisterBuilderWithTypes<TBase extends Record<string, any>, Name extends string, I, O, HasDefault extends boolean = false> = {
    using(factory: HandlerFactory): TypedContainer<TBase & { [K in Name]: { input: I; output: O } }, true>;
    middleware<I2, O2>(mw: Middleware<I2, O2, I, O>): RegisterBuilderWithTypes<TBase, Name, I2, O2, HasDefault>;
} & (HasDefault extends true ? TypedContainer<TBase & { [K in Name]: { input: I; output: O } }, true> : {});

type CamelCaseRegisterBuilderWithTypes<TBase extends Record<string, any>, Name extends string, I, O, HasDefault extends boolean = false> = {
    using(factory: HandlerFactory): CamelCaseTypedContainer<TBase & { [K in Name]: { input: I; output: O } }, true>;
    middleware<I2, O2>(mw: Middleware<I2, O2, I, O>): CamelCaseRegisterBuilderWithTypes<TBase, Name, I2, O2, HasDefault>;
} & (HasDefault extends true ? CamelCaseTypedContainer<TBase & { [K in Name]: { input: I; output: O } }, true> : {});


// ── Adapter method maps ─────────────────────────────────────────────

export type AdapterMethods<T extends Record<string, any>> = {
    [K in keyof T]: (input?: T[K]['input']) => Promise<T[K]['output']>;
};

// ── TypedContainer (api) ────────────────────────────────────────────

export  type TypedContainer<T extends Record<string, any>, HasDefault extends boolean = false> = {
    readonly __$type: T;
    middleware(mw: Middleware<any, any>): TypedContainer<T, HasDefault>;
    using(factory: HandlerFactory): TypedContainer<T, true>;
} & (HasDefault extends true ? AdapterMethods<T> & {
    register<Name extends string>(name: Name): RegisterBuilderWithTypes<T, Name, any, any, true>;
    register<I, O>(name: string): RegisterBuilderWithTypes<T, string, I, O, true>;
    execute<K extends keyof T>(
        name: K,
        input?: T[K]['input']
    ): Promise<T[K]['output']>;
    execute<I = any, O = any>(
        name: string,
        input?: I
    ): Promise<O>;
} : {});


export type Container = ContainerInstance<any, true> | CamelCaseTypedContainer<any, true> | TypedContainer<any, true>
