import type { Middleware, HandlerFactory } from './types';
import { token } from './cancellation';

function compose(factory: HandlerFactory, mw: Middleware<any, any>, name: string) {
    const handler = factory(name);

    return async (input: any) => {
        const t = token();
        return mw(input, (next) => handler(next, t), t);
    };
}

type RegisterBuilder<T extends Record<string, any>, Name extends string> = {
    as<I, O>(): RegisterBuilderWithTypes<T, Name, I, O>;
    middleware(mw: Middleware<any, any>): RegisterBuilderWithMiddleware<T, Name>;
};

type RegisterBuilderWithTypes<T extends Record<string, any>, Name extends string, I, O> = {
    using(factory: HandlerFactory): ContainerInstance<T & { [K in Name]: { input: I; output: O } }>;
    middleware(mw: Middleware<I, O>): RegisterBuilderComplete<T, Name, I, O>;
};

type RegisterBuilderWithMiddleware<T extends Record<string, any>, Name extends string> = {
    as<I, O>(): RegisterBuilderComplete<T, Name, I, O>;
    using(factory: HandlerFactory): ContainerInstance<T & { [K in Name]: { input: any; output: any } }>;
};

type RegisterBuilderComplete<T extends Record<string, any>, Name extends string, I, O> = {
    using(factory: HandlerFactory): ContainerInstance<T & { [K in Name]: { input: I; output: O } }>;
};

type ContainerInstance<T extends Record<string, any>> = {
    register<Name extends string>(name: Name): RegisterBuilder<T, Name>;

    as<I, O, LastKey extends string = string>(): ContainerInstance<
        Omit<T, LastKey> & { [K in LastKey]: { input: I; output: O } }
    >;

    execute<K extends keyof T>(
        name: K,
        input?: T[K]['input']
    ): Promise<T[K]['output']>;

    execute<I = any, O = any>(
        name: string,
        input?: I
    ): Promise<O>;
};

export function container<T extends Record<string, any> = {}>(
    registry = new Map<string, any>()
): ContainerInstance<T> {

    function execute<K extends keyof T>(
        name: K,
        input?: T[K]['input']
    ): Promise<T[K]['output']>;

    function execute<I = any, O = any>(
        name: string,
        input?: I
    ): Promise<O>;

    async function execute(name: string, input?: any): Promise<any> {
        const proc = registry.get(name);
        if (!proc) throw new Error('not found');
        return proc(input);
    }

    function _doRegister<I, O, Name extends string>(
        name: Name,
        factory: HandlerFactory,
        mw: Middleware<I, O> = async (input, next) => next(input)
    ) {
        const procedure = compose(factory, mw, name);

        const newRegistry = new Map(registry);
        newRegistry.set(name, procedure);

        type NewT = T & { [K in Name]: { input: I; output: O } };

        return container<NewT>(newRegistry);
    }

    return {
        // register ahora retorna un builder
        register: <Name extends string>(name: Name): RegisterBuilder<T, Name> => {
            return {
                as: <I, O>(): RegisterBuilderWithTypes<T, Name, I, O> => {
                    return {
                        using: (factory: HandlerFactory) => {
                            return _doRegister<I, O, Name>(name, factory);
                        },
                        middleware: (mw: Middleware<I, O>): RegisterBuilderComplete<T, Name, I, O> => {
                            return {
                                using: (factory: HandlerFactory) => {
                                    return _doRegister<I, O, Name>(name, factory, mw);
                                }
                            };
                        }
                    };
                },
                middleware: (mw: Middleware<any, any>): RegisterBuilderWithMiddleware<T, Name> => {
                    return {
                        as: <I, O>(): RegisterBuilderComplete<T, Name, I, O> => {
                            return {
                                using: (factory: HandlerFactory) => {
                                    return _doRegister<I, O, Name>(name, factory, mw);
                                }
                            };
                        },
                        using: (factory: HandlerFactory) => {
                            return _doRegister<any, any, Name>(name, factory, mw);
                        }
                    };
                }
            };
        },

        // @ts-expect-error
        as: (<I, O>() => {
            return container<any>(registry);
        }) as any,

        execute
    };
}