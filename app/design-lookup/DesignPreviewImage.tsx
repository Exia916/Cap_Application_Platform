"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  src?: string | null;
  alt: string;
  mode?: "thumb" | "hero";
};

export default function DesignPreviewImage({ src, alt, mode = "thumb" }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const hasImage = !!src && !failed;

  return (
    <div style={mode === "hero" ? heroWrap : thumbWrap}>
      {hasImage ? (
        <img
          src={src || ""}
          alt={alt}
          loading={mode === "thumb" ? "lazy" : "eager"}
          onError={() => setFailed(true)}
          style={mode === "hero" ? heroImage : thumbImage}
        />
      ) : (
        <div style={fallbackStyle}>
          <div style={{ fontWeight: 800 }}>No Preview</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Image not available
          </div>
        </div>
      )}
    </div>
  );
}

const thumbWrap: CSSProperties = {
  width: 104,
  height: 72,
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface-subtle)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const thumbImage: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  display: "block",
};

const heroWrap: CSSProperties = {
  minHeight: 420,
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 14,
  background:
    "linear-gradient(45deg, rgba(0,0,0,0.025) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.025) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.025) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.025) 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  padding: 16,
};

const heroImage: CSSProperties = {
  maxWidth: "100%",
  maxHeight: "70vh",
  objectFit: "contain",
  display: "block",
};

const fallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: 4,
  color: "var(--text-muted)",
  textAlign: "center",
  padding: 10,
};