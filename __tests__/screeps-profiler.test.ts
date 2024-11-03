import { AnyFunction, ProfiledFunction } from '../src/profiler';
import { profiler, ProfilerError } from '../src/screeps-profiler';
import { setup } from './setup';

beforeEach(() => {
  setup();
});

function add(a: number, b: number) {
  return a + b;
}

function returnsScope(this: object) {
  return this;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function profilerFn<T extends AnyFunction>(fn: T): ProfiledFunction<T> {
  return fn as ProfiledFunction<T>;
}

function tick(times = 1) {
  let _times = times;
  while (_times > 0) {
    profiler.wrap(() => {});
    Game.time++;
    _times--;
  }
}

describe('screeps-profiler', () => {
  describe('profiling', () => {
    beforeEach(() => {
      // setup the profiler.
      if (Game.profiler) Game.profiler.reset();
      profiler.enable();
      tick();
    });

    describe('registerFunction', () => {
      it('returns a wrapped function', () => {
        const result = profiler.registerFunction(add);
        expect(typeof result).toBe('function');
        expect(profilerFn(result).__profiler).not.toBeNull();
      });

      it('returns a function with the same scope as the one passed in', () => {
        const passedScope = { test: 1 };
        const result = profiler.registerFunction(returnsScope.bind(passedScope));
        expect(result()).toBe(passedScope);
      });


      it('should attempt some toString() preservation', () => {
        const result = profiler.registerFunction(add);
        expect(result.toString().includes(add.toString())).toBe(true);
      });

      it('should preserve properties', () => {
        const func1 = function func1() {};
        func1.prop1 = 1;
        const result1 = profiler.registerFunction(func1);
        expect(result1.prop1).toBe(func1.prop1);

        const func2 = () => {};
        func2.prop2 = 2;
        const result2 = profiler.registerFunction(func2);
        expect(result2.prop2).toBe(func2.prop2);
      });

      it('should preserve constructor behavior', () => {
        class SomeClass {}
        const ResultClass = profiler.registerClass(SomeClass);
        expect(new ResultClass() instanceof SomeClass).toBe(true);
      });
    });

    describe('registerObject', () => {
      it('wraps each function on an object', () => {
        const myObject = {
          add,
          returnsScope,
          doesNotCauseError: 3,
          doesNotCauseError2: {},
        };

        profiler.registerObject(myObject);
        expect(profilerFn(myObject.add).__profiler).not.toBeNull();
        expect(profilerFn(myObject.returnsScope).__profiler).not.toBeNull();
      });

      it('correctly wraps getter/setter functions', () => {
        let myValue = 5;
        const myObj = {
          get someValue() {
            return myValue;
          },
          set someValue(value) {
            myValue = value;
          },
        };

        profiler.registerObject(myObj);
        const descriptors = Object.getOwnPropertyDescriptor(myObj, 'someValue');
        expect(descriptors).not.toBeUndefined()
        expect(profilerFn((descriptors!)['get']!).__profiler).not.toBeNull();
        expect(profilerFn((descriptors!)['set']!).__profiler).not.toBeNull();
        expect(myObj.someValue).toBe(5);
        myObj.someValue = 7;
        expect(myObj.someValue).toBe(7);
      });

      it('throws when registering an invalid object', () => {
        expect(() => {
          profiler.registerObject(undefined as unknown as object);
        }).toThrow(ProfilerError);
        expect(() => {
          profiler.registerObject('yo' as unknown as object);
        }).toThrow(ProfilerError);
      });
    });

    describe('registerClass', () => {
      it('wraps each prototype function on a class', () => {
        class MyFakeClass {
          someFakeMethod() {
          }
        }
        profiler.registerClass(MyFakeClass);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(MyFakeClass.prototype.someFakeMethod).not.toBeNull();
      });

      it('wraps each static function on a class', () => {
        class MyFakeClass {
          static someFakeStaticMethod() {
          }
        }
        profiler.registerClass(MyFakeClass);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(profilerFn(MyFakeClass.someFakeStaticMethod).__profiler).not.toBeNull();
      });
    });

    describe('output', () => {
      it('does not explode if there are no profiled functions', () => {
        Game.profiler.profile(10);
        expect(() => profiler.output()).not.toThrow();
      });

      it('does not explode if there are no duration set', () => {
        Game.profiler.profile();
        expect(() => profiler.output()).not.toThrow();
      });

      it('correctly limits the length of the output', () => {
        Game.profiler.profile(10);
        let functionsWrappedAndRan = 0;
        while (functionsWrappedAndRan < 1000) {
          const fn = profiler.registerFunction(() => {}, `someFakeName${functionsWrappedAndRan}`);
          fn();
          functionsWrappedAndRan++;
        }
        const output = profiler.output();
        expect(output.length > 500).toBe(true);
        expect(output.length <= 1000).toBe(true);
        const smallerOutput = profiler.output(300);
        expect(smallerOutput.length > 100).toBe(true);
        expect(smallerOutput.length <= 300).toBe(true);
      });

      it('can be in callgrind format', () => {
        Game.profiler.callgrind(10);
        const N = 5;
        const someFakeFunction = profiler.registerFunction(() => {}, 'someFakeFunction');
        const someFakeParent = profiler.registerFunction(() => someFakeFunction(), 'someFakeParent');
        for (let i = 0; i < N; ++i) {
          someFakeFunction();
          someFakeParent();
        }
        const format = profiler.callgrind();
        expect(format).toMatch(/fn=someFakeParent/);
        expect(format).toMatch(/cfn=someFakeFunction/);
        expect(format).toMatch(/fn=someFakeFunction/);
      });
    });

    describe('callCounting', () => {
      it('correctly count function calls', () => {
        Game.profiler.profile(10);
        const N = 5;
        const someFakeFunction = profiler.registerFunction(() => {}, 'someFakeFunction');
        for (let i = 0; i < N; ++i) {
          someFakeFunction();
        }
        expect(Memory.profiler.map.someFakeFunction.calls).toBe(N);
      });

      it('correctly count parent function calls', () => {
        Game.profiler.profile(10);
        const N = 5;
        const someFakeFunction = profiler.registerFunction(() => {}, 'someFakeFunction');
        const someFakeParent = profiler.registerFunction(() => someFakeFunction(), 'someFakeParent');
        for (let i = 0; i < N; ++i) {
          someFakeFunction();
          someFakeParent();
        }
        expect(Memory.profiler.map.someFakeParent.calls).toBe(N);
        expect(Memory.profiler.map.someFakeParent.subs.someFakeFunction.calls).toBe(N);
        expect(Memory.profiler.map.someFakeFunction.calls).toBe(2 * N);
      });
    });

    describe('starting', () => {
      it('can start in streaming mode', () => {
        Game.profiler.stream(1);
        tick(2);
      });

      it('can start in email mode', () => {
        Game.profiler.email(1);
        tick(2);
      });

      it('can start in profile mode', () => {
        Game.profiler.profile(1);
        tick(2);
      });

      it('can start in background mode', () => {
        Game.profiler.background();
        tick(2);
      });

      it('can start in callgrind mode', () => {
        Game.profiler.callgrind(1);
        tick(2);
      });
    });

    describe('callgrind output', () => {
      it('logs an error if not profiling', () => {
        Game.profiler.downloadCallgrind();
      });

      it('can be downloaded', () => {
        Game.profiler.profile(1);
        tick(2);
        Game.profiler.downloadCallgrind();
      });
    });
  });
});
