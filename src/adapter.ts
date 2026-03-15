import type {Middleware, HandlerFactory, TypedContainer, CamelCaseTypedContainer} from './types';

// Inline compose: chains middlewares in onion-pattern (no external compound needed)
function compose(...middlewares: Middleware<any, any, any, any>[]): Middleware<any, any, any, any> {
    return (input, next, token) => {
        const dispatch = (index: number, input: any): Promise<any> => {
            if (index === middlewares.length) return next(input);
            return middlewares[index](input, (nextInput) => dispatch(index + 1, nextInput), token);
        };
        return dispatch(0, input);
    };
}

export function api<T extends Record<string, any>, HasDefault extends boolean = false>(
    source: any,
    globalMiddleware: Middleware<any, any>[] = [],
    globalFactory?: HandlerFactory
): TypedContainer<T, HasDefault> {
    const base: any = {
        middleware: (mw: Middleware<any, any>) => {
            return api(source, [...globalMiddleware, mw], globalFactory);
        },
        using: (factory: HandlerFactory) => {
            return api(source.using(factory), globalMiddleware, factory) as any;
        },
    };

    if (source.execute) {
        base.execute = source.execute.bind(source);
    }

    if (source.register) {
        base.register = (name: string) => {
            const builder = source.register(name);

            const wrapBuilder = (b: any, mws: any[]): any => {
                const chain = {
                    using: (factory: HandlerFactory) => {
                        const allMiddlewares = [...globalMiddleware, ...mws];
                        let mwBuilder = b;
                        if (allMiddlewares.length > 0) {
                            const composed = allMiddlewares.length === 1
                                ? allMiddlewares[0]
                                : compose(...allMiddlewares);
                            mwBuilder = b.middleware(composed);
                        }
                        const nextSource = mwBuilder.using(factory);
                        return api(nextSource, globalMiddleware, globalFactory);
                    },
                    middleware: (mw: any) => wrapBuilder(b, [...mws, mw])
                };

                return new Proxy(chain, {
                    get(target, prop: string) {
                        if (prop in target) return (target as any)[prop];
                        
                        if (globalFactory && prop !== 'execute' && prop !== 'register') {
                            return (chain.using(globalFactory) as any)[prop];
                        }

                        const wrapped = api(b, globalMiddleware, globalFactory);
                        return (wrapped as any)[prop];
                    }
                });
            };

            return wrapBuilder(builder, []);
        };
    }

    return new Proxy(base, {
        get(target, name: string) {
            if (name in target)
                return (target as any)[name];
            
            if (name === '__$type') return source.__$type;
            if (name === 'then' || name === 'register' || name === 'execute' || name === 'using' || name === 'middleware')
                return undefined;

            return (input?: any) => source.execute(name, input);
        }
    }) as TypedContainer<T, HasDefault>;
}



function camelToSnake(str: string): string {
    return str.replaceAll(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function jscriptify<T extends Record<string, any>, HasDefault extends boolean = false>(
    container: TypedContainer<T, HasDefault>
): CamelCaseTypedContainer<T, HasDefault> {
    const base: any = {
        middleware: (mw: Middleware<any, any>) => {
            return jscriptify(container.middleware(mw));
        },
        using: (factory: HandlerFactory) => {
            return jscriptify(container.using(factory));
        },
    };

    if ((container as any).execute) {
        base.execute = (container as any).execute.bind(container);
    }

    if ((container as any).register) {
        base.register = (name: string) => {
            const builder = (container as any).register(name);

            const wrapBuilder = (b: any): any => {
                const inner = {
                    using: (factory: HandlerFactory) => {
                        return jscriptify(b.using(factory));
                    },
                    middleware: (mw: any) => wrapBuilder(b.middleware(mw))
                };

                return new Proxy(inner, {
                    get(target, prop: string) {
                        if (prop in target) return (target as any)[prop];

                        const wrapped = jscriptify(b);
                        return (wrapped as any)[prop];
                    }
                });
            };

            return wrapBuilder(builder);
        };
    }

    return new Proxy(base, {
        get(target, prop: string) {
            if (prop in target) {
                return (target as any)[prop];
            }

            if (prop === '__$type') return (container as any).__$type;
            if (prop === 'then' || prop === 'register' || prop === 'execute' || prop === 'using' || prop === 'middleware')
                return undefined;

            const snakeCaseName = camelToSnake(prop);

            return async (input?: any) => {
                try {
                    return await (container as any).execute(snakeCaseName, input);
                } catch (error) {
                    if (snakeCaseName !== prop) {
                        try {
                            return await (container as any).execute(prop, input);
                        } catch {
                            throw error;
                        }
                    }
                    throw error;
                }
            };
        }
    }) as CamelCaseTypedContainer<T, HasDefault>;
}

