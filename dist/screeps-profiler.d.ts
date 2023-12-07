import { AnyFunction } from "./profiler";
export declare class ProfilerError extends Error {
}
export declare class ScreepsProfilerStatic {
    /**
     * Monkey patch the game's global prototypes.
     * Should be called before and outside your main loop.
     */
    static enable(): void;
    /**
     * Wrap your main loop with this function.
     *
     * @param callback - your main loop function
     */
    static wrap<T>(callback: () => T): T;
    /**
     * Register a class to be profiled. Each of the functions on this class will be replaced with
     * a profiler wrapper
     * @param clazz constructor
     * @param className - The name of the class, a label used in output
     */
    static registerClass(clazz: object, label?: string): ObjectConstructor;
    /**
     * Each of the functions on this object will be replaced with a profiler wrapper.
     *
     * @param object - The object to register
     * @param label - Name of the object, a label used in output
     */
    static registerObject(object: object, label?: string): object | ObjectConstructor;
    /**
     * Wraps a function for profiling, returns the wrapped function.
     *
     * Be sure to reassign the function, we can't alter functions that are passed.
     *
     * The second param is optional if you pass a named function function x() {}, but required if
     * you pass an anonymous function var x = function(){}.
     *
     * @param [fnName] - Name of the function, used as a label in output
     * @return the original function wrapped for profiling
     */
    static registerFunction<T extends AnyFunction>(fn: T, label?: string): T;
    /**
     * @deprecated Old name for {@link registerFunction}
     */
    static registerFN<T extends AnyFunction>(fn: T, name: string): T;
    /**
     * Returns the currently running profiling data.
     *
     * @param limit - The maximum number of frames to show
     */
    static output(limit?: number): string;
    /**
     * Returns the currently running profiling data in callgrind format
     *
     * @returns {string}
     */
    static callgrind(): string | null;
}
export declare const profiler: typeof ScreepsProfilerStatic;
