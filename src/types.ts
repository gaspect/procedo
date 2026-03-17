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

export type CaseType = 'snake' | 'camel' | 'both';

export type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
    ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
    : S;

type ProtectedKeys = 'middleware' | 'using' | 'register' | 'execute' | '__$type' | 'then';

export type AdapterMethods<T extends Record<string, any>> = {
    [K in keyof T as K extends ProtectedKeys ? never : K]: (input?: T[K]['input']) => Promise<T[K]['output']>;
};

export type CamelCaseAdapterMethods<T extends Record<string, any>> = {
    [K in keyof T as K extends string ? (SnakeToCamelCase<K> extends ProtectedKeys ? never : SnakeToCamelCase<K>) : never]: (input?: T[K]['input']) => Promise<T[K]['output']>;
};

export type CombinedAdapterMethods<T extends Record<string, any>> = AdapterMethods<T> & CamelCaseAdapterMethods<T>;

export type ContainerInstance<T extends Record<string, any>, HasDefault extends boolean = false, Case extends CaseType = 'both'> = {
    readonly __$type: T;
    middleware(mw: Middleware<any, any>): ContainerInstance<T, HasDefault, Case>;
    using(factory: HandlerFactory): ContainerInstance<T, true, Case>;
    execute<K extends keyof T>(
        name: K,
        input?: T[K]['input']
    ): Promise<T[K]['output']>;
    execute<I = any, O = any>(
        name: string,
        input?: I
    ): Promise<O>;
} & (HasDefault extends true ? {
    register<Name extends string, I, O>(name: Name): RegisterBuilder<T, Name, I, O, Case>;
    register<Name extends string>(name: Name): RegisterBuilder<T, Name, any, any, Case>;
    register<I, O>(name: string): RegisterBuilder<T, string, I, O, Case>;
} : {}) & (
    Case extends 'camel' ? CamelCaseAdapterMethods<T> : 
    Case extends 'both' ? CombinedAdapterMethods<T> : 
    AdapterMethods<T>
);

export type RegisterBuilder<TBase extends Record<string, any>, Name extends string, I, O, Case extends CaseType = 'both'> = {
    using(factory: HandlerFactory): ContainerInstance<TBase & { [K in Name]: { input: I; output: O } }, true, Case>;
    middleware<I2, O2>(mw: Middleware<I2, O2, I, O>): RegisterBuilder<TBase, Name, I2, O2, Case>;
    typed<I2, O2>(): RegisterBuilder<TBase, Name, I2, O2, Case>;
} & ContainerInstance<TBase & { [K in Name]: { input: I; output: O } }, true, Case>;

// ── Compatibility & Universal ───────────────────────────────────────────

export type TypedContainer<T extends Record<string, any>, HasDefault extends boolean = false> = ContainerInstance<T, HasDefault, 'both'>;

export type Container<
    T extends Record<string, any> = {},
    HasDefault extends boolean = true,
    Case extends CaseType = 'both'
> = ContainerInstance<T, HasDefault, Case>;

export type UnsafeContainer = Container<any, true, any> & { [K: string]: any };
