import { describe, it, expect } from 'vitest';
import { container } from '../src/container';
import { api } from '../src/adapter';
import { HandlerFactory, Middleware } from '../src/types';

describe('Advanced Middlewares and Registers', () => {
    // 1. Middleware Factory example
    const withTag = (tag: string): Middleware<string, string, string, string> => 
        async (input, next) => {
            const result = await next(`[${tag}-in] ${input}`);
            return `[${tag}-out] ${result}`;
        };

    const handler: HandlerFactory = (name) => async (input) => `${name}(${input})`;

    it('should work with middleware factories and onion pattern', async () => {
        const app = api(container())
            .using(handler)
            .register('test')
            .middleware(withTag('A')) // Innermost
            .middleware(withTag('B')); // Outermost

        // Con el cambio a reverse():
        // Input -> B -> A -> handler
        // B input: data -> llama next([B-in] data)
        // A input: [B-in] data -> llama next([A-in] [B-in] data)
        // handler returns: test([A-in] [B-in] data)
        // A returns: [A-out] test([A-in] [B-in] data)
        // B returns: [B-out] [A-out] test([A-in] [B-in] data)
        
        const result = await app.test('data');
        expect(result).toBe('[B-out] [A-out] test([A-in] [B-in] data)');
    });

    it('should support type transformation in middleware chain (README example)', async () => {
        // Inner layer (Layer 3): next = handler (number) => Promise<string>
        const layer3: Middleware<number, string, number, string> = async (input, next) => {
            const raw = await next(input);
            return raw.toUpperCase();
        };

        // Middle layer (Layer 2): next = layer3 (number) => Promise<string>
        const layer2: Middleware<{ id: number; verified: boolean }, string, number, string> = async (input, next) => {
            if (!input.verified) throw new Error('Not verified');
            const data = await next(input.id);
            return `[${data}]`;
        };

        // Outer layer (Layer 1): next = layer2 ({id, verified}) => Promise<string>
        const layer1: Middleware<{ token: string; userId: string }, string, { id: number; verified: boolean }, string> = async (input, next) => {
            if (input.token !== 'secret') throw new Error('Unauthorized');
            const result = await next({ id: Number.parseInt(input.userId), verified: true });
            return `AUTHENTICATED: ${result}`;
        };

        const app = api(container())
            .using(handler)
            .register<number, string>('complex_auth')
            .middleware(layer3)
            .middleware(layer2)
            .middleware(layer1);

        const result = await app.complex_auth({ token: 'secret', userId: '99' });
        // Execution: layer1 -> layer2 -> layer3 -> handler
        // handler(99) -> "complex_auth(99)"
        // layer3: "COMPLEX_AUTH(99)"
        // layer2: "[COMPLEX_AUTH(99)]"
        // layer1: "AUTHENTICATED: [COMPLEX_AUTH(99)]"
        expect(result).toBe('AUTHENTICATED: [COMPLEX_AUTH(99)]');
    });

    it('should correctly handle multiple registers with different middleware/factory configurations', async () => {
        const globalMw: Middleware<string, string, string, string> = async (input, next) => `G(${await next(input)})`;
        const localMw: Middleware<string, string, string, string> = async (input, next) => `L(${await next(input)})`;
        const customHandler: HandlerFactory = (name) => async (input) => `C(${name}:${input})`;

        const app = api(container())
            .middleware(globalMw)
            .using(handler)
            .register('proc1')
            .register('proc2')
              .middleware(localMw)
            .register('proc3')
              .middleware(localMw)
              .using(customHandler);

        const res1 = await app.proc1('1'); 
        const res2 = await app.proc2('2'); 
        const res3 = await app.proc3('3'); 

        expect(res1).toBe('G(proc1(1))');
        expect(res2).toBe('G(L(proc2(2)))');
        expect(res3).toBe('G(L(C(proc3:3)))');
    });

    it('should support fluent registration and execution with globalFactory', async () => {
        const app = api(container())
            .using(handler)
            .register('first')
            .register('second');
        
        const r1 = await app.first('a');
        const r2 = await app.second('b');
        
        expect(r1).toBe('first(a)');
        expect(r2).toBe('second(b)');
    });

    it('should allow override of global factory for specific registration', async () => {
        const defaultH: HandlerFactory = (name) => async (input) => `default:${name}(${input})`;
        const overrideH: HandlerFactory = (name) => async (input) => `override:${name}(${input})`;

        const app = api(container())
            .using(defaultH)
            .register('proc1')
            .register('proc2').using(overrideH);

        expect(await app.proc1('x')).toBe('default:proc1(x)');
        expect(await app.proc2('y')).toBe('override:proc2(y)');
    });
});
