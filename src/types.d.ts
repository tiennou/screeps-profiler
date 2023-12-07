export type ProfileType =
  | 'background'
  | 'callgrind'
  | 'email'
  | 'profile'
  | 'stream'

export type FrameInfo = {
  calls: number;
  time: number;
  subs: Frame;
}

export type Frame = Record<string, FrameInfo>;

export type ProfilerMemory = {
  filter?: string;
  totalTime: number;
  enabledTick: number;
  disableTick: number | false;
  type: ProfileType;
  map: Frame;
}
