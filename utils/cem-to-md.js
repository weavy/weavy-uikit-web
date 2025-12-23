import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import { makeModuleDoc } from "@custom-elements-manifest/to-markdown";
import { serialize } from "@custom-elements-manifest/to-markdown/lib/serialize.js";
import { root, heading, text, list, listItem, link } from "mdast-builder";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const manifest = JSON.parse(await fs.readFile("./dist/custom-elements.json", "utf-8"));

const options = { 
  omitDeclarations: ["variables"],
  omitSections: ["main-heading","super-class"],
  private: "details" 
};

async function writeMD(moduleMD) {
    try {
      if (!(await fs.stat(moduleMD.srcFile.dir)).isDirectory()) {
        throw new Error();
      }
    } catch {
      await fs.mkdir(moduleMD.srcFile.dir, { recursive: true });
    }

    const mdFile = path.format({ dir: moduleMD.srcFile.dir, name: moduleMD.srcFile.name, ext: ".md" });

    try {
      await fs.writeFile(mdFile, moduleMD.md, { encoding: "utf8" });
      console.log(`${moduleMD.srcFile.name}.md`);
    } catch (e) {
      console.error(e.message);
    }
}

function buildIndex(basePath, refs) {
  
  const groups = {};

  refs.forEach((ref) => {
    const pathName = ref.name.substr(0, ref.name.lastIndexOf("/"))
    groups[pathName] ??= [];
    groups[pathName].push(ref);
  })

  const groupList = Object.entries(groups);

  groupList.sort((a, b) => !a[0] && b[0] ? -1 : 0)

  return [
    heading(1, text("Weavy Component API")),
    ...groupList.map(([group, groupRefs]) => [
      group ? heading(2, text(group)) : undefined,
      list("unordered", groupRefs.map((ref) => listItem(
          link(basePath + ref.srcFile.name, undefined , text(ref.srcFile.name))
        ))
      )
    ].filter(x => x)).flat()
  ]
}

if (manifest.modules?.length) {

  const docsPath = path.resolve(__dirname, "../dist/docs");
  const moduleMDRefs = [];

  manifest.modules.flatMap((mod) => {
    const moduleMD = { name: mod.path, md: serialize(root(makeModuleDoc(mod, options).filter((x) => x))) };

    // Rewrite links
    moduleMD.name = moduleMD.name.replace(/^lib\//, "");
    moduleMD.md = moduleMD.md.replaceAll(".ts)", ")");
    moduleMD.srcFile = path.parse(path.resolve(docsPath, moduleMD.name));

    moduleMDRefs.push(moduleMD);
  });

  moduleMDRefs.forEach(async (moduleMD) => await writeMD(moduleMD))

  const indexMD = { name:  "index", md: serialize(root(buildIndex("./", moduleMDRefs))), srcFile: path.parse(path.resolve(docsPath, "index")) };
  await writeMD(indexMD);
}
