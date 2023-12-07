export type AnyFunction = ((...args: any) => any);
export type ProfiledFunction<T extends AnyFunction> = T & {
    __profiler?: typeof Profiler;
};
