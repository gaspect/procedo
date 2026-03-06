import { Compensation } from "./types";

export interface CancellationToken {
    cancel(): void;
    compensation(fn: Compensation): void;
}

export function token(): CancellationToken {
    const compensations: Compensation[] = [];
    return {
        cancel() {
            for (const fn of compensations.toReversed())
                fn();
            throw new Error('Cancelled');
        },
        compensation(fn: Compensation) {
            compensations.push(fn);
        }
    };
}