import { api, container, Container } from "../src";
import { describe, expect, it } from "vitest";

describe("Api types with parameters", () => {
  let c = api(container()).using((name) => {
    return async (_, __) => name;
  });

  function decorator(_c: Container) {
    return _c
      .register<unknown, string>("testing_snake")
      .middleware(async (i, next) => next(i)).testingSnake;
  }

  it("should return testing without error types", async () => {
    let r2 = await decorator(c)();
    expect(r2).toEqual("testing_snake");
  });

  function decoratorWithTyped(_c: Container) {
    const fn = _c
      .register("testing_snake")
      .typed<unknown, string>()
      .middleware(async (i, next) => next(i));

    return fn.testingSnake;
  }

  it("should return testing with typed() builder", async () => {
    let r2 = await decoratorWithTyped(c)();
    expect(r2).toEqual("testing_snake");
  });

  function decoratorWith3Params(_c: Container) {
    const fn = _c
      .register<"testing_snake", unknown, string>("testing_snake")
      .middleware(async (i, next) => next(i));

    return fn.testingSnake;
  }

  it("should return testing with 3-param register overload", async () => {
    let r2 = await decoratorWith3Params(c)();
    expect(r2).toEqual("testing_snake");
  });
});
