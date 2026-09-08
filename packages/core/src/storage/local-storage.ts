import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import type { AssetStorage } from "./asset-cache.js";

/**
 * Local-disk implementation of AssetStorage, used for the dev cache dir.
 * Swapping to R2 later means writing an R2AssetStorage that implements the
 * same interface -- no caller of AssetCache changes.
 */
export class LocalAssetStorage implements AssetStorage {
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    return path.join(this.rootDir, key);
  }

  async has(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async put(
    key: string,
    data: Buffer,
    _contentType: string,
  ): Promise<{ key: string; url: string }> {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return { key, url: filePath };
  }
}
