"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Profiler = void 0;
const cli_1 = require("./cli");
function isProfiled(fn) {
    return fn.__profiler !== undefined;
}
function Constructor(fn) {
    return fn;
}
// Hack to ensure the InterShardMemory constant exists in sim
try {
    InterShardMemory;
}
catch (e) {
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
];
const TICK = '(tick)';
const ROOT = '(root)';
class _Profiler {
    constructor() {
        // private
        this.usedOnStart = 0;
        this.enabled = false;
        this.depth = 0;
        this.parentFn = TICK;
        this.map = {};
        this.totalTime = 0;
        this.enabledTick = 0;
        this.disableTick = false;
        this.type = "profile";
        this.filter = undefined;
    }
    enable() {
        this.enabled = true;
        this.hookUpPrototypes();
    }
    hookUpPrototypes() {
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
        Game.profiler = new cli_1.ProfilerGameProfiler();
        this.overloadCPUCalc();
    }
    overloadCPUCalc() {
        if (Game.rooms.sim) {
            const usedOnStart = this.usedOnStart = 0; // This needs to be reset, but only in the sim.
            Game.cpu.getUsed = function getUsed() {
                return performance.now() - usedOnStart;
            };
        }
    }
    restart() {
        if (!this.isProfiling())
            return false;
        let duration = false;
        if (typeof this.disableTick === "number") {
            // Calculate the original duration, profile is enabled on the tick after the first call,
            // so add 1.
            duration = this.disableTick - this.enabledTick + 1;
        }
        this.setupMemory(this.type, duration, this.filter);
        return true;
    }
    setupMemory(profileType, duration, filter) {
        this.resetMemory();
        let disableTick = false;
        if (Number.isInteger(duration)) {
            disableTick = Game.time + duration;
        }
        this.disableTick = disableTick;
        this.type = profileType;
        this.filter = filter;
        console.log(`Profiling type ${profileType} started at ${Game.time + 1} for ${duration} ticks`);
    }
    resetMemory() {
        this.map = {};
        this.totalTime = 0;
        this.enabledTick = Game.time + 1;
        this.disableTick = false;
        this.type = "profile";
        this.filter = undefined;
    }
    endTick() {
        if (Game.time >= this.enabledTick) {
            const cpuUsed = Game.cpu.getUsed();
            this.totalTime += cpuUsed;
            this.report();
        }
    }
    report() {
        if (this.shouldPrint()) {
            this.printProfile();
        }
        else if (this.shouldEmail()) {
            this.emailProfile();
        }
        else if (this.shouldCallgrind()) {
            this.downloadCallgrind();
        }
    }
    // #region Profiling
    isProfiling() {
        if (!this.enabled) {
            return false;
        }
        return !this.disableTick || Game.time <= this.disableTick;
    }
    initFrame(functionName, map = this.map) {
        if (!map[functionName]) {
            map[functionName] = {
                time: 0,
                calls: 0,
                subs: {},
            };
        }
    }
    record(functionName, time, parent) {
        this.initFrame(functionName);
        this.map[functionName].calls++;
        this.map[functionName].time += time;
        if (parent) {
            this.initFrame(parent);
            this.initFrame(functionName, this.map[parent].subs);
            this.map[parent].subs[functionName].calls++;
            this.map[parent].subs[functionName].time += time;
        }
    }
    wrapFunction(name, originalFunction) {
        if (isProfiled(originalFunction)) {
            originalFunction.__profiler = exports.Profiler;
            return originalFunction;
        }
        function wrappedFunction() {
            const profiler = wrappedFunction.__profiler;
            if (!profiler.isProfiling()) {
                let result;
                if (this && this.constructor === wrappedFunction) {
                    result = new (Constructor(originalFunction))(...arguments);
                }
                else {
                    const args = [...arguments];
                    result = originalFunction.apply(this, args);
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
            let result;
            if (this && this.constructor === wrappedFunction) {
                result = new (Constructor(originalFunction))(...arguments);
            }
            else {
                const args = [...arguments];
                result = originalFunction.apply(this, args);
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
        wrappedFunction.__profiler = exports.Profiler;
        wrappedFunction.toString = () => `// screeps-profiler wrapped function:\n${originalFunction.toString()}`;
        for (const property of Object.getOwnPropertyNames(originalFunction)) {
            if (commonProperties.includes(property))
                continue;
            // @ts-expect-error wrapping function properties
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            wrappedFunction[property] = originalFunction[property];
        }
        return wrappedFunction;
    }
    profileObjectFunctions(object, label) {
        if (object.prototype) {
            this.profileObjectFunctions(object.prototype, label);
        }
        const objectToWrap = object;
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
                const profileDescriptor = {};
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
            const originalFunction = objectToWrap[functionName];
            // @ts-expect-error wrapping function properties
            objectToWrap[functionName] = this.profileFunction(originalFunction, extendedLabel);
        });
        return objectToWrap;
    }
    profileFunction(fn, functionName) {
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
        console.log(download
            .split('\n')
            .map((s) => s.trim())
            .join(''));
    }
    callgrind() {
        if (!this.enabledTick)
            return null;
        const elapsedTicks = Game.time - this.enabledTick + 1;
        this.initFrame(TICK);
        this.map[TICK].calls = elapsedTicks;
        this.map[TICK].time = this.totalTime;
        this.initFrame(ROOT);
        this.map[ROOT].calls = 1;
        this.map[ROOT].time = this.totalTime;
        this.initFrame(TICK, this.map[ROOT].subs);
        this.map[ROOT].subs[TICK].calls = elapsedTicks;
        this.map[ROOT].subs[TICK].time = this.totalTime;
        let body = `events: ns\nsummary: ${Math.round(this.totalTime * 1000000)}\n`;
        for (const fnName of Object.keys(this.map)) {
            const fn = this.map[fnName];
            let callsBody = '';
            let callsTime = 0;
            for (const callName of Object.keys(fn.subs)) {
                const call = fn.subs[callName];
                const ns = Math.round(call.time * 1000000);
                callsBody += `cfn=${callName}\ncalls=${call.calls} 1\n1 ${ns}\n`;
                callsTime += call.time;
            }
            body += `\nfn=${fnName}\n1 ${Math.round((fn.time - callsTime) * 1000000)}\n${callsBody}`;
        }
        return body;
    }
    output(passedOutputLengthLimit) {
        const outputLengthLimit = passedOutputLengthLimit || 1000;
        if (!this || !this.enabledTick) {
            return 'Profiler not active.';
        }
        const endTick = Math.min(this.disableTick || Game.time, Game.time);
        const startTick = this.enabledTick;
        const elapsedTicks = endTick - startTick + 1;
        const header = 'calls\t\ttime\t\tavg\t\tfunction';
        const footer = [
            `Avg: ${(this.totalTime / elapsedTicks).toFixed(2)}`,
            `Total: ${this.totalTime.toFixed(2)}`,
            `Ticks: ${elapsedTicks}`,
        ].join('\t');
        const lines = [header];
        let currentLength = header.length + 1 + footer.length;
        const allLines = this.lines();
        let done = false;
        while (!done && allLines.length) {
            const line = allLines.shift();
            // each line added adds the line length plus a new line character.
            if (currentLength + line.length + 1 < outputLengthLimit) {
                lines.push(line);
                currentLength += line.length + 1;
            }
            else {
                done = true;
            }
        }
        lines.push(footer);
        return lines.join('\n');
    }
    lines() {
        const stats = Object.keys(this.map).map(functionName => {
            const functionCalls = this.map[functionName];
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
        const onEndingTick = this.disableTick === Game.time;
        return streaming || (profiling && onEndingTick);
    }
    shouldEmail() {
        return this.type === 'email' && this.disableTick === Game.time;
    }
    shouldCallgrind() {
        return (this.type === 'callgrind' &&
            this.disableTick === Game.time);
    }
}
/** @internal */
exports.Profiler = new _Profiler();
