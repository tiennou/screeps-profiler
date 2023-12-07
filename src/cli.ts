import { Profiler } from "./profiler";

/**
 * The Screeps Profiler is a library that helps to understand where your CPU is being spent in
 * the game of Screeps.
 * It works by monkey patching functions on the Global game object prototypes, with a function that
 * record how long each function takes. The primary benefit of using this profiler is that you can
 * get a clear picture of where your CPU is being used over time, and optimize some of the heavier functions.
 * While it works best for players that heavily employ prototypes in their code, it should work
 * to some degree for all players.
 *
 * Any modules that you use that modify the game's prototypes should be imported
 * before you require the profiler.
 *
 * @see More information at https://github.com/gdborton/screeps-profiler
 */
export class ProfilerGameProfiler {
  /**
   * Will run for the given number of ticks then will output the gathered information to the console.
   *
   * @param ticks - controls how long the profiler should run before stopping
   * @param [functionFilter] - limit the scope of the profiler to a specific function name
   */
  profile(duration?: number, filter?: string) {
    Profiler.setupMemory('profile', duration || 100, filter);
  }

  /**
   * Will run for the given number of ticks, and will output the gathered information each tick to
   * the console. The can sometimes be useful for seeing spikes in performance.
   *
   * @param ticks - controls how long the profiler should run before stopping
   * @param [functionFilter] - limit the scope of the profiler to a specific function name
   */
  stream(duration?: number, filter?: string) {
    Profiler.setupMemory('stream', duration || 10, filter);
  }

  /**
   * This will run for the given number of ticks, and will email the output to your registered
   * Screeps email address. Very useful for long running profiles.
   *
   * @param ticks - controls how long the profiler should run before stopping
   * @param [functionFilter] - limit the scope of the profiler to a specific function name
   */
  email(duration?: number, filter?: string) {
    Profiler.setupMemory('email', duration || 100, filter);
  }

  /**
   * This will run indefinitely, and will only output data when the output console command is run.
   * Very useful for long running profiles with lots of function calls.
   *
   * @param [functionFilter] - limit the scope of the profiler to a specific function name
   */
  background(filter?: string) {
    Profiler.setupMemory('background', false, filter);
  }

  /**
   * Will run for the given number of ticks then will download the gathered information as a callgrind file
   * 
   * @param ticks - controls how long the profiler should run before stopping
   * @param [functionFilter] - limit the scope of the profiler to a specific function name
   */
  callgrind(duration?: number, filter?: string) {
    Profiler.setupMemory('callgrind', duration || 100, filter);
  }

  /**
   * Print a report based on the current tick.
   * 
   * The profiler will continue to operate normally.
   * This is currently the only way to get data from the background profile.
   *
   * @param [lineCount=20] the number of lines to output
   */
  output(limit?: number) {
    Profiler.output(limit)
  }

  /**
   * Download the current profile as a callgrind file.
   * 
   * The profiler will continue to operate normally.
   */
  downloadCallgrind() {
    Profiler.downloadCallgrind();
  }

  /**
   *  Restarts the profiler using the same options previously used to start it.
   */
  restart() {
    Profiler.restart();
  }

  /**
   * Stops the profiler and resets its memory. This is currently the only way to stop a background profile.
   */
  reset() {
    Profiler.resetMemory();
  }
}