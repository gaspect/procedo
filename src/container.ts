import type {Middleware, HandlerFactory, ContainerInstance} from './types';
import {token} from './cancellation';

function compose(factory: HandlerFactory, mws: Middleware<any, any>[], name: string) {
    const handler = factory(name);

    return async (input: any) => {
        const t = token();
        const dispatch = (index: number, currentInput: any): Promise<any> => {
            if (index === mws.length) return handler(currentInput, t);
            return mws[index](currentInput, (nextInput: any) => dispatch(index + 1, nextInput), t);
        };
        return dispatch(0, input);
    };
}

export function container(): ContainerInstance<{}, false>;

export function container<T extends Record<string, any> = {}, HasDefault extends boolean = false>(
    registry?: Map<string, any>,
    defaultFactory?: HandlerFactory,
    globalMiddlewares?: Middleware<any, any>[]
): ContainerInstance<T, HasDefault>;

export function container<T extends Record<string, any> = {}, HasDefault extends boolean = false>(
    registry = new Map<string, any>(),
    defaultFactory?: HandlerFactory,
    globalMiddlewares: Middleware<any, any>[] = []
): ContainerInstance<T, HasDefault> {

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
        
        if (globalMiddlewares.length > 0) {
            const t = token();
            const dispatch = (index: number, currentInput: any): Promise<any> => {
                if (index === globalMiddlewares.length) return proc(currentInput);
                return globalMiddlewares[index](currentInput, (nextInput: any) => dispatch(index + 1, nextInput), t);
            };
            return dispatch(0, input);
        }

        return proc(input);
    }

    function _doRegister<I, O, Name extends string>(
        name: Name,
        factory: HandlerFactory,
        mws: Middleware<any, any>[] = []
    ) {
        const procedure = compose(factory, mws, name);

        const newRegistry = new Map(registry);
        newRegistry.set(name, procedure);

        type NewT = T & { [K in Name]: { input: I; output: O } };

        return container<NewT, true>(newRegistry, factory, globalMiddlewares);
    }

    const self: any = {
        using: (factory: HandlerFactory) => {
            return container<T, true>(registry, factory, globalMiddlewares);
        },
        middleware: (mw: Middleware<any, any>) => {
            return container<T, HasDefault>(registry, defaultFactory, [...globalMiddlewares, mw]);
        },
        execute
    };

    if (defaultFactory) {
        self.register = <Name extends string>(name: Name) => {
            const createBuilder = (mws: Middleware<any, any>[] = []) => {
                const builder = {
                    using: (factory: HandlerFactory) => {
                        return _doRegister<any, any, Name>(name, factory, mws);
                    },
                    middleware: (mw: Middleware<any, any>) => {
                        return createBuilder([...mws, mw]);
                    }
                };

                const chain = _doRegister<any, any, Name>(name, defaultFactory, mws);
                return Object.assign(chain, builder);
            };

            return createBuilder();
        };
        self.execute = execute;
    }

    return self as unknown as ContainerInstance<T, HasDefault>;
}