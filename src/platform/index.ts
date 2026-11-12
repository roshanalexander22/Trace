import { isTauriRuntime, type PlatformAdapter } from "./adapter";
import { TauriAdapter } from "./tauriAdapter";
import { WebAdapter } from "./webAdapter";

export const platform: PlatformAdapter = isTauriRuntime()
  ? new TauriAdapter()
  : new WebAdapter();

