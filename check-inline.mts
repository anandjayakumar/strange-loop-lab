import { renderInline } from "./src/lib/markdown.ts";
const input = '*"My Self-Model says rough terrain is deadly-but I have zero actual experience to back that up!"* Waiting until its energy';
console.log(renderInline(input));
