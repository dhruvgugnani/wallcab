type BrandMarkProps = {
  className?: string;
  variant?: "compact" | "cabinet";
};

export function BrandMark({
  className,
  variant = "compact",
}: BrandMarkProps) {
  if (variant === "cabinet") {
    return (
      <svg
        className={className}
        viewBox="0 0 260 360"
        role="img"
        aria-label="WallCab cabinet mark"
      >
        <rect x="7" y="7" width="246" height="346" rx="123" />
        <path d="M36 173h188M130 31v298" />
        <rect x="108" y="151" width="44" height="44" rx="22" />
        <path d="m118 166 12 14 13-28" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 42 42"
      role="img"
      aria-label="WallCab"
    >
      <rect x="2" y="2" width="38" height="38" rx="19" />
      <path d="M10 20.5h22M21 9v23" />
      <circle cx="21" cy="20.5" r="3.5" />
    </svg>
  );
}
