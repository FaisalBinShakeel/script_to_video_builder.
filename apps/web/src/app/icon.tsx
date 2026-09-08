import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7C5CFF",
          borderRadius: 7,
          color: "white",
          fontSize: 20,
          fontWeight: 800,
        }}
      >
        V
      </div>
    ),
    size,
  );
}
