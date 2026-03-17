import { describe, it, expect } from 'vitest';
import { container } from '../src/container';
import { HandlerFactory, Middleware } from '../src/types';

describe('container', () => {
    it('should throw an error if procedure is not found', async () => {
        const c = container();
        await expect(c.execute('unknown')).rejects.toThrow('not found');
    });

    it('should register and execute a procedure with using', async () => {
        const factory: HandlerFactory = (name) => async (input) => `hello ${input} from ${name}`;
        const c = container().using(factory).register('greet');
        
        const result = await c.execute('greet', 'world');
        expect(result).toBe('hello world from greet');
    });

    it('should support global middleware', async () => {
        const factory: HandlerFactory = () => async (input) => input;
        const mw: Middleware = async (input, next) => {
            const result = await next(input);
            return `[${result}]`;
        };

        const c = container()
            .middleware(mw)
            .using(factory)
            .register('test');

        const result = await c.execute('test', 'data');
        expect(result).toBe('[data]');
    });

    it('should support procedure-specific middleware', async () => {
        const factory: HandlerFactory = () => async (input) => input;
        const mw: Middleware = async (input, next) => {
            return await next(`mw(${input})`);
        };

        const c = container()
            .using(factory)
            .register('test')
            .middleware(mw);

        const result = await c.execute('test', 'data');
        expect(result).toBe('mw(data)');
    });

    it('should pass cancellation token to handler and middleware', async () => {
        let tokenInMw: any;
        let tokenInHandler: any;

        const mw: Middleware = async (input, next, token) => {
            tokenInMw = token;
            return await next(input);
        };

        const factory: HandlerFactory = () => async (input, token) => {
            tokenInHandler = token;
            return input;
        };

        const c = container()
            .middleware(mw)
            .using(factory)
            .register('test');

        await c.execute('test', 'data');
        
        expect(tokenInMw).toBeDefined();
        expect(tokenInHandler).toBeDefined();
        // Since execute for global middlewares creates a new token and compose for procedures also creates one
        // Wait, let's look at the code.
        // In execute():
        // if (globalMiddlewares.length > 0) { const t = token(); ... }
        // In compose():
        // return async (input: any) => { const t = token(); ... }
        // Actually, if there are global middlewares, execute creates a token. 
        // Then it calls proc(input). proc is the composed handler.
        // The composed handler (from compose) ALSO creates its own token.
        // So tokenInMw and tokenInHandler might be different if one is global and other is procedure-specific.
    });

    it('should allow multiple global middlewares in order', async () => {
        const factory: HandlerFactory = () => async (input) => input;
        const mw1: Middleware = async (input, next) => await next(`mw1(${input})`);
        const mw2: Middleware = async (input, next) => await next(`mw2(${input})`);

        const c = container()
            .middleware(mw1)
            .middleware(mw2)
            .using(factory)
            .register('test');

        const result = await c.execute('test', 'data');
        expect(result).toBe('mw2(mw1(data))');
    });

    it('should allow procedure-specific middleware chain', async () => {
        const factory: HandlerFactory = () => async (input) => input;
        const mw1: Middleware = async (input, next) => await next(`mw1(${input})`);
        const mw2: Middleware = async (input, next) => await next(`mw2(${input})`);

        const c = container()
            .using(factory)
            .register('test')
            .middleware(mw1)
            .middleware(mw2);

        const result = await c.execute('test', 'data');
        expect(result).toBe('mw1(mw2(data))');
    });

    it('should combine global and procedure-specific middleware correctly', async () => {
        const factory: HandlerFactory = () => async (input) => input;
        const globalMw: Middleware = async (input, next) => await next(`global(${input})`);
        const localMw: Middleware = async (input, next) => await next(`local(${input})`);

        const c = container()
            .middleware(globalMw)
            .using(factory)
            .register('test')
            .middleware(localMw);

        const result = await c.execute('test', 'data');
        // globalMw wraps the whole proc call.
        // localMw is part of the proc call.
        expect(result).toBe('local(global(data))');
    });
});
