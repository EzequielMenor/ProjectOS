import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Renders Markdown with the app's typography. Internal links go through the router. No raw HTML is rendered. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-pos text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = "", children: c, title }) =>
            href.startsWith("/") ? (
              <Link href={href} title={title} className="text-primary underline-offset-2 hover:underline">
                {c}
              </Link>
            ) : href === "#" ? (
              <span title={title} className="rounded border border-dashed px-1 text-muted-foreground">
                {c}
              </span>
            ) : (
              <a href={href} title={title} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-2 hover:underline">
                {c}
              </a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
