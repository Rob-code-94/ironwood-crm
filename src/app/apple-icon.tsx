import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          background: "#0f172a",
          color: "#f8fafc",
          fontSize: 64,
          fontWeight: 700,
        }}
      >
        IW
      </div>
    ),
    size
  )
}
