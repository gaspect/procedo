import { Compensation } from "./types";

export interface CancellationToken {
    readonly isCancelled: boolean;
    cancel(): void;
    compensation(fn: Compensation): void;
    check(): void;
}

export function token(): CancellationToken {
    let cancelled = false;
    const compensations: Compensation[] = [];

    return {
        get isCancelled() {
            return cancelled;
        },
        cancel() {
            cancelled = true;
            for (const fn of compensations.toReversed())
                fn();
        },
        compensation(fn: Compensation) {
            compensations.push(fn);
        },
        check() {
            if (cancelled) {
                throw new Error('Cancelled');
            }
        },
    };
}