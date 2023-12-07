import { AnyFunction, Profiler } from "./profiler";

export class ProfilerError extends Error {}

export class ScreepsProfilerStatic {

  /**
   * Monkey patch the game's global prototypes.
   * Should be called before and outside your main loop.
   */
  static enable() {
    Profiler.enable();
  }

  /**
   * Wrap your main loop with this function.
   *
   * @param callback - your main loop function
   */
  static wrap<T>(callback: () => T): T {
    if (Profiler.enabled) {
      Profiler.setupProfiler();
    }

    if (Profiler.isProfiling()) {
      Profiler.usedOnStart = Game.cpu.getUsed();

      // Commented lines are part of an on going experiment to keep the profiler
      // performant, and measure certain types of overhead.

      // var callbackStart = Game.cpu.getUsed();
      const returnVal = callback();
      // var callbackEnd = Game.cpu.getUsed();
      Profiler.endTick();
      // var end = Game.cpu.getUsed();

      // var profilerTime = (end - start) - (callbackEnd - callbackStart);
      // var callbackTime = callbackEnd - callbackStart;
      // var unaccounted = end - profilerTime - callbackTime;
      // console.log('total-', end, 'profiler-', profilerTime, 'callbacktime-',
      // callbackTime, 'start-', start, 'unaccounted', unaccounted);
      return returnVal;
    }

    return callback();
  }

  /**
   * Register a class to be profiled. Each of the functions on this class will be replaced with
   * a profiler wrapper
   * @param clazz constructor
   * @param className - The name of the class, a label used in output
   */
  static registerClass(clazz: object, label?: string) {
    if (!clazz || !(typeof clazz === 'object' || typeof clazz === 'function')) {
      throw new ProfilerError(`Asked to profile non-class ${String(clazz)} for ${label} (${typeof clazz})`);
    }
    return Profiler.profileObjectFunctions(clazz, label) as ObjectConstructor;
  }

  /**
   * Each of the functions on this object will be replaced with a profiler wrapper.
   *
   * @param object - The object to register
   * @param label - Name of the object, a label used in output
   */
  static registerObject(object: object, label?: string) {
    if (!object || !(typeof object === 'object' || typeof object === 'function')) {
      throw new ProfilerError(`Asked to profile non-object ${String(object)} for ${label} (${typeof object})`);
    }

    return Profiler.profileObjectFunctions(object, label);
  }
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
  static registerFunction<T extends AnyFunction>(fn: T, label?: string) {
    if (!fn || typeof fn !== 'function') {
      throw new ProfilerError(`Asked to profile non-function ${String(fn)} for ${label} (${typeof fn})`);
    }
    return Profiler.profileFunction(fn, label);
  }

  /**
   * @deprecated Old name for {@link registerFunction}
   */
  static registerFN<T extends AnyFunction>(fn: T, name: string) {
    return this.registerFunction(fn, name);
  }

  /**
   * Returns the currently running profiling data.
   *
   * @param limit - The maximum number of frames to show
   */
  static output(limit?: number): string {
    return Profiler.output(limit);
  }

  /**
   * Returns the currently running profiling data in callgrind format
   *
   * @returns {string}
   */
  static callgrind(): string | null {
    return Profiler.callgrind();
  }
}

export const profiler = ScreepsProfilerStatic;
