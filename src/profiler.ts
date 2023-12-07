import { ProfilerGameProfiler } from "./cli";
import type { ProfileType } from "./types";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = ((...args: any) => any);
export type ProfiledFunction<T extends AnyFunction> = T & { __profiler?: typeof Profiler };

function isProfiled<T extends AnyFunction>(fn: T): fn is ProfiledFunction<T> {
  return (fn as ProfiledFunction<T>).__profiler !== undefined;
}

type ConstructorType<T extends AnyFunction> = { new (...args: unknown[]): ReturnType<T> };

function Constructor<T extends AnyFunction>(fn: AnyFunction): ConstructorType<T> {
  return fn as unknown as ConstructorType<T>;
}

// Hack to ensure the InterShardMemory constant exists in sim
try {
  InterShardMemory;
} catch (e) {
  // @ts-expect-error global
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.InterShardMemory = undefined;
}

const functionBlackList = [
  'getUsed', // Let's avoid wrapping this... may lead to recursion issues and should be inexpensive.
  'constructor', // es6 class constructors need to be called with `new`
];

const commonProperties = ['length', 'name', 'arguments', 'caller', 'prototype'];

const PROTOTYPES = [
  { name: 'ConstructionSite', val: ConstructionSite },
  { name: 'Creep', val: Creep },
  { name: 'Deposit', val: Deposit },
  { name: 'Flag', val: Flag },
  { name: 'Game', val: Game },
  { name: 'InterShardMemory', val: InterShardMemory },
  { name: 'Mineral', val: Mineral },
  { name: 'Nuke', val: Nuke },
  { name: 'OwnedStructure', val: OwnedStructure },
  { name: 'PathFinder', val: PathFinder },
  { name: 'PowerCreep', val: PowerCreep },
  { name: 'RawMemory', val: RawMemory },
  { name: 'Resource', val: Resource },
  { name: 'Room', val: Room },
  { name: 'RoomObject', val: RoomObject },
  { name: 'RoomPosition', val: RoomPosition },
  { name: 'RoomVisual', val: RoomVisual },
  { name: 'Ruin', val: Ruin },
  { name: 'Source', val: Source },
  { name: 'Store', val: Store },
  { name: 'Structure', val: Structure },
  { name: 'StructureContainer', val: StructureContainer },
  { name: 'StructureController', val: StructureController },
  { name: 'StructureExtension', val: StructureExtension },
  { name: 'StructureExtractor', val: StructureExtractor },
  { name: 'StructureFactory', val: StructureFactory },
  { name: 'StructureInvaderCore', val: StructureInvaderCore },
  { name: 'StructureKeeperLair', val: StructureKeeperLair },
  { name: 'StructureLab', val: StructureLab },
  { name: 'StructureLink', val: StructureLink },
  { name: 'StructureNuker', val: StructureNuker },
  { name: 'StructureObserver', val: StructureObserver },
  { name: 'StructurePortal', val: StructurePortal },
  { name: 'StructurePowerBank', val: StructurePowerBank },
  { name: 'StructurePowerSpawn', val: StructurePowerSpawn },
  { name: 'StructureRampart', val: StructureRampart },
  { name: 'StructureRoad', val: StructureRoad },
  { name: 'StructureSpawn', val: StructureSpawn },
  { name: 'StructureStorage', val: StructureStorage },
  { name: 'StructureTerminal', val: StructureTerminal },
  { name: 'StructureTower', val: StructureTower },
  { name: 'StructureWall', val: StructureWall },
  { name: 'Tombstone', val: Tombstone },
]

const TICK = '(tick)';
const ROOT = '(root)';

class _Profiler {

  usedOnStart = 0;
  enabled = false;
  depth = 0;
  parentFn = TICK;

  enable() {
    this.enabled = true;
    this.hookUpPrototypes();
  }

  private hookUpPrototypes() {
    for (const { name, val } of PROTOTYPES) {
      if (!val) {
        console.log(`skipping prototype hook ${name}, object appears to be missing`);
        continue;
      }
      this.profileObjectFunctions(val, name);
    }
  }

  setupProfiler() {
    this.depth = 0; // reset depth, this needs to be done each tick.
    this.parentFn = TICK;
    Game.profiler = new ProfilerGameProfiler();
    this.overloadCPUCalc();
  }

  private overloadCPUCalc() {
    if (Game.rooms.sim) {
      const usedOnStart = this.usedOnStart = 0; // This needs to be reset, but only in the sim.
      Game.cpu.getUsed = function getUsed() {
        return performance.now() - usedOnStart;
      };
    }
  }

  get type(): ProfileType {
    return Memory.profiler.type;
  }

  get filter() {
    return Memory.profiler.filter;
  }

  restart() {
    if (!this.isProfiling()) return false;

    const { type, filter, disableTick, enabledTick } = Memory.profiler;
    
    let duration: number | false = false;
    if (typeof disableTick === "number") {
      // Calculate the original duration, profile is enabled on the tick after the first call,
      // so add 1.
      duration = disableTick - enabledTick + 1;
    }
    this.setupMemory(type, duration, filter);
    return true;
  }

  setupMemory(profileType: ProfileType, duration: number | false, filter?: string) {
    this.resetMemory();
    let disableTick: number | false = false;
    if (Number.isInteger(duration)) {
      disableTick = Game.time + (duration as number);
    }
    
    Memory.profiler = {
      map: {},
      totalTime: 0,
      enabledTick: Game.time + 1,
      disableTick,
      type: profileType,
      filter,
    };
  
    console.log(`Profiling type ${profileType} started at ${Game.time + 1} for ${duration} ticks`);
  }

  resetMemory() {
    // @ts-expect-error forcibly reset the memory
    Memory.profiler = undefined;
  }

  endTick() {
    if (Game.time >= Memory.profiler.enabledTick) {
      const cpuUsed = Game.cpu.getUsed();
      Memory.profiler.totalTime += cpuUsed;
      this.report();
    }
  }

  report() {
    if (this.shouldPrint()) {
      this.printProfile();
    } else if (this.shouldEmail()) {
      this.emailProfile();
    } else if (this.shouldCallgrind()) {
      this.downloadCallgrind();
    }
  }

  // #region Profiling

  isProfiling() {
    if (!this.enabled || !Memory.profiler) {
      return false;
    }
    return !Memory.profiler.disableTick || Game.time <= Memory.profiler.disableTick;
  }

  initFrame(functionName: string, map = Memory.profiler.map) {
    if (!map[functionName]) {
      map[functionName] = {
        time: 0,
        calls: 0,
        subs: {},
      };
    }
  }

  private record(functionName: string, time: number, parent: string) {
    this.initFrame(functionName);
    Memory.profiler.map[functionName].calls++;
    Memory.profiler.map[functionName].time += time;
    if (parent) {
      this.initFrame(parent);
      this.initFrame(functionName, Memory.profiler.map[parent].subs);
      Memory.profiler.map[parent].subs[functionName].calls++;
      Memory.profiler.map[parent].subs[functionName].time += time;
    }
  }

  private wrapFunction<T extends AnyFunction>(name: string, originalFunction: T): ProfiledFunction<T> {
    if (isProfiled(originalFunction)) {
      originalFunction.__profiler = Profiler;
      return originalFunction;
    }
  
    function wrappedFunction(this: ProfiledFunction<T>): ReturnType<T> {
      const profiler = wrappedFunction.__profiler;
      if (!profiler.isProfiling()) {
        let result: ReturnType<T>;
        if (this && this.constructor === wrappedFunction) {
          result = new (Constructor<T>(originalFunction))(...arguments);
        } else {
          const args = [...arguments] as unknown[];
          result = originalFunction.apply<ProfiledFunction<T>, unknown[], ReturnType<T>>(this, args);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      }

      const nameMatchesFilter = name === profiler.filter;
      const start = Game.cpu.getUsed();
      if (nameMatchesFilter) {
        profiler.depth++;
      }
      const curParent = profiler.parentFn;
      profiler.parentFn = name;
      let result: ReturnType<T>;
      if (this && this.constructor === wrappedFunction) {
        result = new (Constructor<T>(originalFunction))(...arguments);
      } else {
        const args = [...arguments] as unknown[];
        result = originalFunction.apply<ProfiledFunction<T>, unknown[], ReturnType<T>>(this, args);
      }
      profiler.parentFn = curParent;
      if (profiler.depth > 0 || !profiler.filter) {
        const end = Game.cpu.getUsed();
        profiler.record(name, end - start, profiler.parentFn);
      }
      if (nameMatchesFilter) {
        profiler.depth--;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    }
  
    wrappedFunction.__profiler = Profiler;
    wrappedFunction.toString = () =>
      `// screeps-profiler wrapped function:\n${originalFunction.toString()}`;
  
    for (const property of Object.getOwnPropertyNames(originalFunction)) {
      if (commonProperties.includes(property)) continue;
      // @ts-expect-error wrapping function properties
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      wrappedFunction[property] = originalFunction[property];
    }
  
    return wrappedFunction as unknown as ProfiledFunction<T>;
  }

  profileObjectFunctions(object: object | ObjectConstructor, label?: string) {
    if ((object as ObjectConstructor).prototype) {
      this.profileObjectFunctions((object as ObjectConstructor).prototype, label);
    }
    const objectToWrap: object = object;

    Object.getOwnPropertyNames(objectToWrap).forEach(functionName => {
      const extendedLabel = `${label}.${functionName}`;

      const isBlackListed = functionBlackList.indexOf(functionName) !== -1;
      if (isBlackListed) {
        return;
      }

      const descriptor = Object.getOwnPropertyDescriptor(objectToWrap, functionName);
      if (!descriptor) {
        return;
      }

      const hasAccessor = descriptor['get'] || descriptor['set'];
      if (hasAccessor) {
        const configurable = descriptor.configurable;
        if (!configurable) {
          return;
        }

        const profileDescriptor: PropertyDescriptor = {};

        if (descriptor.get) {
          const extendedLabelGet = `${extendedLabel}:get`;
          profileDescriptor.get = this.profileFunction(descriptor['get'], extendedLabelGet);
        }

        if (descriptor.set) {
          const extendedLabelSet = `${extendedLabel}:set`;
          profileDescriptor.set = this.profileFunction(descriptor['set'], extendedLabelSet);
        }

        Object.defineProperty(objectToWrap, functionName, profileDescriptor);
        return;
      }

      const isFunction = typeof descriptor.value === 'function';
      if (!isFunction || !descriptor.writable) {
        return;
      }
      // @ts-expect-error wrapping function properties
      const originalFunction = objectToWrap[functionName] as AnyFunction;
      // @ts-expect-error wrapping function properties
      objectToWrap[functionName] = this.profileFunction(originalFunction, extendedLabel);
    });

    return objectToWrap;
  }

  profileFunction<T extends AnyFunction>(fn: T, functionName?: string): T {
    const fnName = functionName || fn.name;
    if (!fnName) {
      console.log('Couldn\'t find a function name for - ', fn);
      console.log('Will not profile this function.');
      return fn;
    }
  
    return this.wrapFunction(fnName, fn);
  }

  // #endregion

  // #region Output

  printProfile() {
    console.log(this.output());
  }

  emailProfile() {
    Game.notify(this.output(1000));
  }

  downloadCallgrind() {
    const id = `id${Math.random()}`;
    const shardId = Game.shard.name + (Game.shard.ptr ? '-ptr' : '');
    const filename = `callgrind.${shardId}.${Game.time}`;
    const data = this.callgrind();
    if (!data) {
      console.log('No profile data to download');
      return;
    }
    /* eslint-disable */
    const download = `
    <script>
    var element = document.getElementById('${id}');
    if (!element) {
      element = document.createElement('a');
      element.setAttribute('id', '${id}');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,${encodeURIComponent(data)}');
      element.setAttribute('download', '${filename}');

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();
    }
    </script>
    `;
    /* eslint-enable */
    console.log(
      download
        .split('\n')
        .map((s) => s.trim())
        .join('')
    );
  }

  callgrind() {
    if (!Memory.profiler || !Memory.profiler.enabledTick) return null;
    const elapsedTicks = Game.time - Memory.profiler.enabledTick + 1;
    this.initFrame(TICK);
    Memory.profiler.map[TICK].calls = elapsedTicks;
    Memory.profiler.map[TICK].time = Memory.profiler.totalTime;
    this.initFrame(ROOT);
    Memory.profiler.map[ROOT].calls = 1;
    Memory.profiler.map[ROOT].time = Memory.profiler.totalTime;
    this.initFrame(TICK, Memory.profiler.map[ROOT].subs);
    Memory.profiler.map[ROOT].subs[TICK].calls = elapsedTicks;
    Memory.profiler.map[ROOT].subs[TICK].time = Memory.profiler.totalTime;
    let body = `events: ns\nsummary: ${Math.round(
      Memory.profiler.totalTime * 1000000
    )}\n`;
    for (const fnName of Object.keys(Memory.profiler.map)) {
      const fn = Memory.profiler.map[fnName];
      let callsBody = '';
      let callsTime = 0;
      for (const callName of Object.keys(fn.subs)) {
        const call = fn.subs[callName];
        const ns = Math.round(call.time * 1000000);
        callsBody += `cfn=${callName}\ncalls=${call.calls} 1\n1 ${ns}\n`;
        callsTime += call.time;
      }
      body += `\nfn=${fnName}\n1 ${Math.round(
        (fn.time - callsTime) * 1000000
        )}\n${callsBody}`;
    }
    return body;
  }

  output(passedOutputLengthLimit?: number) {
    const outputLengthLimit = passedOutputLengthLimit || 1000;
    if (!Memory.profiler || !Memory.profiler.enabledTick) {
      return 'Profiler not active.';
    }

    const endTick = Math.min(Memory.profiler.disableTick || Game.time, Game.time);
    const startTick = Memory.profiler.enabledTick;
    const elapsedTicks = endTick - startTick + 1;
    const header = 'calls\t\ttime\t\tavg\t\tfunction';
    const footer = [
      `Avg: ${(Memory.profiler.totalTime / elapsedTicks).toFixed(2)}`,
      `Total: ${Memory.profiler.totalTime.toFixed(2)}`,
      `Ticks: ${elapsedTicks}`,
    ].join('\t');

    const lines = [header];
    let currentLength = header.length + 1 + footer.length;
    const allLines = this.lines();
    let done = false;
    while (!done && allLines.length) {
      const line = allLines.shift()!;
      // each line added adds the line length plus a new line character.
      if (currentLength + line.length + 1 < outputLengthLimit) {
        lines.push(line);
        currentLength += line.length + 1;
      } else {
        done = true;
      }
    }
    lines.push(footer);
    return lines.join('\n');
  }

  lines() {
    const stats = Object.keys(Memory.profiler.map).map(functionName => {
      const functionCalls = Memory.profiler.map[functionName];
      return {
        name: functionName,
        calls: functionCalls.calls,
        totalTime: functionCalls.time,
        averageTime: functionCalls.time / functionCalls.calls,
      };
    }).sort((val1, val2) => {
      return val2.totalTime - val1.totalTime;
    });

    const lines = stats.map(data => {
      return [
        data.calls,
        data.totalTime.toFixed(1),
        data.averageTime.toFixed(3),
        data.name,
      ].join('\t\t');
    });

    return lines;
  }

  shouldPrint() {
    const streaming = this.type === 'stream';
    const profiling = this.type === 'profile';
    const onEndingTick = Memory.profiler.disableTick === Game.time;
    return streaming || (profiling && onEndingTick);
  }

  shouldEmail() {
    return this.type === 'email' && Memory.profiler.disableTick === Game.time;
  }

  shouldCallgrind() {
    return (
      this.type === 'callgrind' &&
      Memory.profiler.disableTick === Game.time
    );
  }

  // #endregion
}

/** @internal */
export const Profiler = new _Profiler();
