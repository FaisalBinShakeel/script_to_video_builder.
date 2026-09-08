import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AssetStorage } from "./asset-cache.js";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * R2 (S3-compatible) implementation of AssetStorage -- the same interface
 * LocalAssetStorage (phase 2) implements, so AssetCache and every caller of
 * it are unchanged by this swap.
 */
export class R2AssetStorage implements AssetStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async has(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async put(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<{ key: string; url: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return { key, url: key };
  }
}

/**
 * Signs a short-lived download URL for a render output. Outputs are never
 * served through a public/raw URL -- every download goes through a freshly
 * signed link (licensing + access-control requirement).
 */
export async function signRenderDownloadUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
