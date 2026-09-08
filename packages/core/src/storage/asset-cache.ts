export interface AssetStorage {
  /** True if this key has already been persisted. */
  has(key: string): Promise<boolean>;
  /** Persists `data` under `key`. Idempotent: safe to call for a key that
   * already exists (implementations should skip the write). */
  put(key: string, data: Buffer, contentType: string): Promise<{ key: string; url: string }>;
}

export interface CacheableAsset {
  provider: string;
  providerAssetId: string;
  fileUrl: string;
}

export interface CachedAssetRecord {
  provider: string;
  providerAssetId: string;
  storageKey: string;
  url: string;
}

/**
 * Provider-agnostic cache keyed by (provider, providerAssetId). Downloading
 * and persisting the bytes is delegated to an AssetStorage implementation so
 * the backend (local disk today, R2 later) can be swapped without touching
 * any caller of AssetCache.
 */
export class AssetCache {
  private readonly index = new Map<string, CachedAssetRecord>();

  constructor(
    private readonly storage: AssetStorage,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private key(provider: string, providerAssetId: string): string {
    return `${provider}/${providerAssetId}`;
  }

  async lookup(
    provider: string,
    providerAssetId: string,
  ): Promise<CachedAssetRecord | undefined> {
    return this.index.get(this.key(provider, providerAssetId));
  }

  /**
   * Ensures the asset is downloaded and stored, returning the cache record.
   * A cache hit (in-memory index or the storage backend already has the
   * key) skips the download entirely.
   */
  async ensureCached(asset: CacheableAsset): Promise<CachedAssetRecord> {
    const storageKey = this.key(asset.provider, asset.providerAssetId);

    const existing = this.index.get(storageKey);
    if (existing) return existing;

    if (await this.storage.has(storageKey)) {
      const record: CachedAssetRecord = {
        provider: asset.provider,
        providerAssetId: asset.providerAssetId,
        storageKey,
        url: storageKey,
      };
      this.index.set(storageKey, record);
      return record;
    }

    const response = await this.fetchImpl(asset.fileUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download asset ${storageKey} from ${asset.fileUrl}: ${response.status}`,
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "video/mp4";

    const stored = await this.storage.put(storageKey, buffer, contentType);
    const record: CachedAssetRecord = {
      provider: asset.provider,
      providerAssetId: asset.providerAssetId,
      storageKey: stored.key,
      url: stored.url,
    };
    this.index.set(storageKey, record);
    return record;
  }
}
