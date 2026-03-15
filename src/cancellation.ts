import { Compensation, CancellationToken } from "./types";

export function token(): CancellationToken {
    const compensations: Compensation[] = [];
    let _cancelled = false;

    return {
        get isCancelled() { return _cancelled; },
        cancel() {
            if (_cancelled) return;
            _cancelled = true;
            for (const fn of [...compensations].reverse()) {
                try {
                    fn();
                } catch (e) {
                    console.error('Error in compensation task:', e);
                }
            }
            throw new Error('Cancelled');
        },
        compensation(fn: Compensation) {
            compensations.push(fn);
        }
    };
}