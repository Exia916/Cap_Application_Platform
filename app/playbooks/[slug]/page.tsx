import { notFound } from "next/navigation";
import PlaybookArticleView from "../PlaybookArticleView";
import {
  getPublishedPlaybookArticleBySlug,
  listRelatedPlaybookArticles,
} from "@/lib/repositories/playbooksRepo";

export default async function PlaybookArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await getPublishedPlaybookArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedRows = await listRelatedPlaybookArticles(article.id);

  const publishedRelated = relatedRows.filter(
    (row) => row.status === "published" && !row.isDeleted
  );

  return (
    <PlaybookArticleView
      article={article}
      relatedArticles={publishedRelated}
    />
  );
}