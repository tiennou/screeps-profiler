
export function setup() {

  const start = Date.now();
  global.Game = {
    cpu: {
      getUsed() {
        return Date.now() - start;
      },
    },
    notify(_msg, _int?: number | undefined) {},
    shard: { name: 'test', type: 'normal', ptr: false },
    rooms: {},
    time: 10,
  } as Game;

  // @ts-expect-error global
  global.Memory = {};
  
  // @ts-expect-error global
  global.ConstructionSite = class {};
  // @ts-expect-error global
  global.Creep = class {};
  // @ts-expect-error global
  global.Deposit = class {};
  // @ts-expect-error global
  global.Flag = class {};
  // @ts-expect-error global
  global.InterShardMemory = class {};
  // @ts-expect-error global
  global.Mineral = class {};
  // @ts-expect-error global
  global.Nuke = class {};
  // @ts-expect-error global
  global.OwnedStructure = class {};
  // @ts-expect-error global
  global.PathFinder = class {};
  // @ts-expect-error global
  global.PowerCreep = class {};
  // @ts-expect-error global
  global.RawMemory = class {};
  // @ts-expect-error global
  global.Resource = class {};
  // @ts-expect-error global
  global.Room = class {};
  // @ts-expect-error global
  global.RoomObject = class {};
  // @ts-expect-error global
  global.RoomPosition = class {};
  // @ts-expect-error global
  global.RoomVisual = class {};
  // @ts-expect-error global
  global.Ruin = class {};
  // @ts-expect-error global
  global.Source = class {};
  // @ts-expect-error global
  global.Store = class {};
  // @ts-expect-error global
  global.Structure = class {};
  // @ts-expect-error global
  global.StructureContainer = class {};
  // @ts-expect-error global
  global.StructureController = class {};
  // @ts-expect-error global
  global.StructureExtension = class {};
  // @ts-expect-error global
  global.StructureExtractor = class {};
  // @ts-expect-error global
  global.StructureFactory = class {};
  // @ts-expect-error global
  global.StructureInvaderCore = class {};
  // @ts-expect-error global
  global.StructureKeeperLair = class {};
  // @ts-expect-error global
  global.StructureLab = class {};
  // @ts-expect-error global
  global.StructureLink = class {};
  // @ts-expect-error global
  global.StructureNuker = class {};
  // @ts-expect-error global
  global.StructureObserver = class {};
  // @ts-expect-error global
  global.StructurePortal = class {};
  // @ts-expect-error global
  global.StructurePowerBank = class {};
  // @ts-expect-error global
  global.StructurePowerSpawn = class {};
  // @ts-expect-error global
  global.StructureRampart = class {};
  // @ts-expect-error global
  global.StructureRoad = class {};
  // @ts-expect-error global
  global.StructureSpawn = class {};
  // @ts-expect-error global
  global.StructureStorage = class {};
  // @ts-expect-error global
  global.StructureTerminal = class {};
  // @ts-expect-error global
  global.StructureTower = class {};
  // @ts-expect-error global
  global.StructureWall = class {};
  // @ts-expect-error global
  global.Tombstone = class {};
}

setup();