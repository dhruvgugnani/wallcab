import Link from "next/link";

export function ArticleHeader({
  title,
  description,
  date,
  readingTime,
}: {
  title: string;
  description: string;
  date: string;
  readingTime: string;
}) {
  return (
    <header className="article-header">
      <Link href="/blog">← Journal</Link>
      <p className="eyebrow">Field notes</p>
      <h1>{title}</h1>
      <p className="article-deck">{description}</p>
      <div>
        <span>Dhruv Gugnani</span>
        <time dateTime={date}>{date}</time>
        <span>{readingTime}</span>
      </div>
    </header>
  );
}
