import { CancellationToken } from "./cancellation";

export type Handler<I = void, O = any> =
    (input: I, token: CancellationToken) => Promise<O>;

export type Middleware<I = void, O = any> =
    (input: I,
        next: (input: any) => Promise<any>,
        token: CancellationToken
    ) => Promise<O>;

export type HandlerFactory =
    (procedureName: string) => Handler<any, any>;

export type Compensation = () => Promise<void> | void;

