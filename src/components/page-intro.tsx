type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
};

export function PageIntro({
  eyebrow,
  title,
  description,
  meta,
}: PageIntroProps) {
  return (
    <header className="page-intro section-shell">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="page-intro-copy">
        <p>{description}</p>
        {meta ? <span>{meta}</span> : null}
      </div>
    </header>
  );
}
