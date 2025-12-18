import * as migration_20251217_055734 from "./20251217_055734";
import * as migration_20251218_130100 from "./20251218_130100";

export const migrations = [
  {
    up: migration_20251217_055734.up,
    down: migration_20251217_055734.down,
    name: "20251217_055734"
  },
  {
    up: migration_20251218_130100.up,
    down: migration_20251218_130100.down,
    name: "20251218_130100",
  },
];
