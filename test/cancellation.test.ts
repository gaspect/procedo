import { describe, it, expect, vi } from 'vitest';
import { token } from '../src/cancellation';

describe('cancellation', () => {
    it('should initialize with isCancelled as false', () => {
        const t = token();
        expect(t.isCancelled).toBe(false);
    });

    it('should set isCancelled to true when cancel is called', () => {
        const t = token();
        try {
            t.cancel();
        } catch (e) {
            // expected
        }
        expect(t.isCancelled).toBe(true);
    });

    it('should throw an error when cancel is called', () => {
        const t = token();
        expect(() => t.cancel()).toThrow('Cancelled');
    });

    it('should execute compensations in reverse order', async () => {
        const t = token();
        const calls: number[] = [];
        
        t.compensation(() => { calls.push(1); });
        t.compensation(() => { calls.push(2); });
        t.compensation(() => { calls.push(3); });

        try {
            t.cancel();
        } catch (e) {
            // expected
        }

        expect(calls).toEqual([3, 2, 1]);
    });

    it('should handle errors in compensations and continue', () => {
        const t = token();
        const calls: number[] = [];
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        t.compensation(() => { calls.push(1); });
        t.compensation(() => { throw new Error('fail'); });
        t.compensation(() => { calls.push(3); });

        try {
            t.cancel();
        } catch (e) {
            // expected
        }

        expect(calls).toEqual([3, 1]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should only cancel once', () => {
        const t = token();
        const calls: number[] = [];
        t.compensation(() => { calls.push(1); });

        try {
            t.cancel();
        } catch (e) {
            // expected
        }

        // second call should do nothing (not even throw if it's already cancelled? Wait, let's check the code)
        // code: if (_cancelled) return;
        t.cancel(); 

        expect(calls).toHaveLength(1);
    });
});
