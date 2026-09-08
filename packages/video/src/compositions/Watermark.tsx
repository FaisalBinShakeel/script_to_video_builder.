export function Watermark() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 24,
        fontWeight: 700,
        color: "rgba(255,255,255,0.7)",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      Made with Video Builder
    </div>
  );
}
