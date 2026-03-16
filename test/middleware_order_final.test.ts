import { describe, it, expect } from 'vitest';
import { container } from '../src/container';
import { api } from '../src/adapter';
import { HandlerFactory, Middleware } from '../src/types';

describe('Middleware execution order final check', () => {
    const handler: HandlerFactory = (name) => async (input) => `${name}(${input})`;

    const tag = (name: string): Middleware<string, string, string, string> => 
        async (input, next) => {
            const res = await next(`${name}_in->${input}`);
            return `${name}_out->${res}`;
        };

    it('should follow Global1 -> Global2 -> SpecificOuter -> SpecificInner -> Handler', async () => {
        const app = api(container())
            .middleware(tag('G1'))
            .middleware(tag('G2'))
            .using(handler)
            .register('test')
            .middleware(tag('S_Inner')) // First Specific is innermost (closest to handler)
            .middleware(tag('S_Outer')); // Second Specific is outermost

        const result = await app.test('data');

        // Predicted order:
        // G1_in -> G2_in -> S_Outer_in -> S_Inner_in -> handler -> S_Inner_out -> S_Outer_out -> G2_out -> G1_out
        
        expect(result).toBe('G1_out->G2_out->S_Outer_out->S_Inner_out->test(S_Inner_in->S_Outer_in->G2_in->G1_in->data)');
    });
});
