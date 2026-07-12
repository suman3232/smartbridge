// Render an SVG string to report-diagrams/<name>.svg + .png (high-res)
import { createRequire } from "module";
import { writeFileSync } from "fs";
const require = createRequire("file:///C:/Users/suman/Downloads/smartdeal-bridge-main/smartdeal-bridge-main/package.json");
const sharp = require("sharp");

const OUT = "C:/Users/suman/Downloads/smartdeal-bridge-main/smartdeal-bridge-main/report-diagrams/";

export async function render(name, svg, targetW = 3500) {
  writeFileSync(OUT + name + ".svg", svg);
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const w = parseFloat(m[1]);
  const density = Math.min(72 * (targetW / w), 400);
  const info = await sharp(Buffer.from(svg), { density }).png().toFile(OUT + name + ".png");
  console.log(`${name}: ${info.width}x${info.height} png + svg written`);
}
