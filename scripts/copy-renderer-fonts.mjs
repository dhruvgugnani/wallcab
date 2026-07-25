import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontDirectory = join(projectRoot, "src", "server", "fonts");

const fonts = [
  {
    source:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf",
    destination: "manrope-variable.ttf",
  },
  {
    source:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf",
    destination: "fraunces-variable.ttf",
  },
  {
    source:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf",
    destination: "fraunces-variable-italic.ttf",
  },
];

await mkdir(fontDirectory, { recursive: true });

await Promise.all(
  fonts.map(async ({ source, destination }) => {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Could not download ${source}: ${response.status}`);
    }

    await writeFile(
      join(fontDirectory, destination),
      Buffer.from(await response.arrayBuffer()),
    );
  }),
);

console.log(`Downloaded ${fonts.length} renderer fonts to ${fontDirectory}`);
