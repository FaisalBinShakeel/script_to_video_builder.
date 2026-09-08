import type {
  FootageProviderClient,
  FootageSearchOptions,
  RawFootageResult,
  Orientation,
} from "../pipeline/footage.js";

interface PixabayVideoRendition {
  url: string;
  width: number;
  height: number;
  size: number;
}

interface PixabayHit {
  id: number;
  duration: number;
  pageURL: string;
  user: string;
  videos: {
    large: PixabayVideoRendition;
    medium: PixabayVideoRendition;
    small: PixabayVideoRendition;
    tiny: PixabayVideoRendition;
  };
}

interface PixabaySearchResponse {
  hits: PixabayHit[];
}

function toPixabayVideoType(orientation: Orientation): string {
  // Pixabay's video_type filter is coarse (film|animation); orientation
  // itself isn't filterable server-side, so we filter locally by aspect
  // ratio using the "large" rendition dimensions.
  return orientation === "landscape" ? "film" : "film";
}

export class PixabayClient implements FootageProviderClient {
  readonly name = "pixabay" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(
    keyword: string,
    opts: FootageSearchOptions,
  ): Promise<RawFootageResult[]> {
    const url = new URL("https://pixabay.com/api/videos/");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("q", keyword);
    url.searchParams.set("video_type", toPixabayVideoType(opts.orientation));
    url.searchParams.set("per_page", "15");

    const response = await this.fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Pixabay search failed (${response.status}) for "${keyword}"`);
    }
    const data = (await response.json()) as PixabaySearchResponse;

    return data.hits.map((hit): RawFootageResult => {
      const rendition = hit.videos.large;
      return {
        provider: "pixabay",
        providerAssetId: String(hit.id),
        fileUrl: rendition.url,
        width: rendition.width,
        height: rendition.height,
        durationSec: hit.duration,
        attribution: {
          provider: "pixabay",
          photographer: hit.user,
          sourceUrl: hit.pageURL,
        },
      };
    });
  }
}
