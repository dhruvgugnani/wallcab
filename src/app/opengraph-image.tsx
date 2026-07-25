import { ImageResponse } from "next/og";

export const alt = "WallCab — Turn the glance into a lesson";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "58px 66px",
          background: "#0a0a08",
          color: "#f0ede4",
          border: "1px solid #3a3934",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 25,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 40,
              height: 40,
              border: "2px solid #f0ede4",
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </div>
          WallCab
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "#a8b89a",
              fontSize: 19,
              letterSpacing: 5,
              textTransform: "uppercase",
            }}
          >
            Daily learning wallpapers
          </span>
          <span
            style={{
              marginTop: 18,
              fontFamily: "Georgia",
              fontSize: 91,
              lineHeight: .9,
              letterSpacing: -5,
            }}
          >
            Turn the glance
            <br />
            into a lesson.
          </span>
        </div>
        <div
          style={{
            display: "flex",
            paddingTop: 18,
            borderTop: "1px solid #3a3934",
            color: "#aaa69d",
            fontSize: 18,
            justifyContent: "space-between",
          }}
        >
          <span>One useful idea, every day.</span>
          <span>No account. Free and open source.</span>
        </div>
      </div>
    ),
    size,
  );
}
