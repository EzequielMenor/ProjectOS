import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "_" });
td.use(gfm);
// Plane renders empty paragraphs and editor-only wrappers; keep text, drop the noise.
td.remove(["style", "script"]);
// Turndown pads bullets to "-   item"; use the conventional single space.
td.addRule("tightListItem", {
  filter: "li",
  replacement(content, node, options) {
    const body = content.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n/gm, "\n  ");
    const parent = node.parentNode as HTMLElement | null;
    let prefix = `${options.bulletListMarker} `;
    if (parent?.nodeName === "OL") {
      const start = parent.getAttribute("start");
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = `${(start ? Number(start) : 1) + index}. `;
    }
    return prefix + body + (node.nextSibling && !/\n$/.test(body) ? "\n" : "");
  },
});

/** Converts Plane's rich-text HTML into Markdown. Plain text passes through unchanged. */
export function htmlToMarkdown(html: string | null | undefined): string {
  const src = (html ?? "").trim();
  if (!src || src === "<p></p>" || src === "<p class=\"editor-paragraph-block\"></p>") return "";
  if (!/<[a-z][\s\S]*>/i.test(src)) return src;
  return td.turndown(src).replace(/\n{3,}/g, "\n\n").trim();
}
