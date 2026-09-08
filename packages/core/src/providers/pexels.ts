import type {
  FootageProviderClient,
  FootageSearchOptions,
  RawFootageResult,
  Orientation,
} from "../pipeline/footage.js";

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
  file_type: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

function toPexelsOrientation(orientation: Orientation): string {
  if (orientation === "portrait") return "portrait";
  if (orientation === "landscape") return "landscape";
  return "square";
}

function bestVideoFile(video: PexelsVideo): PexelsVideoFile | undefined {
  return [...video.video_files]
    .filter((f) => f.file_type === "video/mp4")
    .sort((a, b) => b.height * b.width - a.height * a.width)[0];
}

export class PexelsClient implements FootageProviderClient {
  readonly name = "pexels" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(
    keyword: string,
    opts: FootageSearchOptions,
  ): Promise<RawFootageResult[]> {
    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", keyword);
    url.searchParams.set("orientation", toPexelsOrientation(opts.orientation));
    url.searchParams.set("size", "large");
    url.searchParams.set("per_page", "15");

    const response = await this.fetchImpl(url, {
      headers: { Authorization: this.apiKey },
    });
    if (!response.ok) {
      throw new Error(`Pexels search failed (${response.status}) for "${keyword}"`);
    }
    const data = (await response.json()) as PexelsSearchResponse;

    return data.videos
      .map((video): RawFootageResult | undefined => {
        const file = bestVideoFile(video);
        if (!file) return undefined;
        return {
          provider: "pexels",
          providerAssetId: String(video.id),
          fileUrl: file.link,
          width: file.width,
          height: file.height,
          durationSec: video.duration,
          attribution: {
            provider: "pexels",
            photographer: video.user.name,
            photographerUrl: video.user.url,
            sourceUrl: video.url,
          },
        };
      })
      .filter((v): v is RawFootageResult => v !== undefined);
  }
}
