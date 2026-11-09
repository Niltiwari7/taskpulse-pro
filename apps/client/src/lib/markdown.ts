import {marked} from "marked";
import DomPurify from "dompurify";

// Allow-list, not block-list: anything not named here is removed.
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "del", "code", "pre", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "a", "hr",
  "input"
]

const ALLOWED_ATTR = ["href", "title","type","checked","disabled"];

// Runs on every <a></a> after cleaning: open in a new tab without leaking window.opener.
DomPurify.addHook("afterSanitizeAttributes", (node) => {
  if(node.tagName === "A") {
    node.setAttribute("target","_blank");
     node.setAttribute("rel", "noopener noreferrer");
  }
})

export function renderMarkdown(source : string): string {
  const html = marked.parse(source, {async: false, gfm:true, breaks:true}) as string
  return DomPurify.sanitize(html,{ALLOWED_TAGS, ALLOWED_ATTR})
}