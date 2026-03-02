import { Middleware } from "./types";

export function compound<I, O>(...middlewares: Middleware<any, any>[]): Middleware<I, O> {
    return (input, next, token) => {
        const dispatch = (index: number, input: any): Promise<any> => {
            if (index === middlewares.length) {
                return next(input);
            }
            const mw = middlewares[index];
            return mw(input, (nextInput) => dispatch(index + 1, nextInput), token);
        };
        return dispatch(0, input);
    };
}