import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const documents = [
  {
    id: "manual",
    source: "docs/MANUEL_UTILISATEUR_GOODISSIMA.md",
    output: "docs/MANUEL_UTILISATEUR_GOODISSIMA.docx",
    title: "Manuel utilisateur Goodissima",
  },
  {
    id: "ai",
    source: "docs/ai-governance/AI_GOVERNANCE.md",
    output: "docs/ai-governance/AI_GOVERNANCE.docx",
    title: "AI Governance - Goodissima",
  },
  {
    id: "matching",
    source: "docs/matching-governance/MATCHING_GOVERNANCE.md",
    output: "docs/matching-governance/MATCHING_GOVERNANCE.docx",
    title: "Matching Governance - Goodissima",
  },
];

const tempRoot = path.join(rootDir, ".tmp-docx-export");

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function paragraphXml(runs, style) {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  const runXml = runs
    .map((run) => {
      const bold = run.bold ? "<w:rPr><w:b/></w:rPr>" : "";
      return `<w:r>${bold}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p>${styleXml}${runXml}</w:p>`;
}

function inlineRuns(text) {
  const runs = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false });
  }

  return runs.length > 0 ? runs : [{ text, bold: false }];
}

function pngDimensions(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    return { width: 900, height: 500 };
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function imageParagraphXml({ relId, alt, width, height }) {
  const maxWidthEmu = 5_700_000;
  const emuPerPixel = 9525;
  let cx = width * emuPerPixel;
  let cy = height * emuPerPixel;

  if (cx > maxWidthEmu) {
    const ratio = maxWidthEmu / cx;
    cx = maxWidthEmu;
    cy = Math.round(cy * ratio);
  }

  return `<w:p>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${Math.round(cx)}" cy="${Math.round(cy)}"/>
        <wp:docPr id="${relId.replace(/\D/g, "") || "1"}" name="${escapeXml(alt)}"/>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="${escapeXml(alt)}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${relId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${Math.round(cx)}" cy="${Math.round(cy)}"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;
}

function markdownToParagraphs(markdown, fallbackTitle, sourceDir, mediaDir) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const paragraphs = [];
  const relationships = [];
  let inCodeBlock = false;
  let sawTitle = false;
  let imageIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (/^<a\s+id=/.test(line.trim())) {
      continue;
    }

    if (inCodeBlock) {
      paragraphs.push(paragraphXml([{ text: line, bold: false }], "Code"));
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    if (image) {
      const imagePath = path.join(sourceDir, decodeURIComponent(image[2]));
      if (existsSync(imagePath)) {
        imageIndex += 1;
        const relId = `rIdImage${imageIndex}`;
        const fileName = `image-${imageIndex}${path.extname(imagePath).toLowerCase() || ".png"}`;
        const targetPath = path.join(mediaDir, fileName);
        const dimensions = pngDimensions(imagePath);

        copyFileSync(imagePath, targetPath);
        relationships.push({ id: relId, target: `media/${fileName}` });
        paragraphs.push(imageParagraphXml({
          relId,
          alt: image[1] || `Capture ${imageIndex}`,
          width: dimensions.width,
          height: dimensions.height,
        }));
      } else {
        paragraphs.push(
          paragraphXml(
            [{ text: `Image : ${image[1] || "capture"} (${image[2]})`, bold: false }],
            "Caption",
          ),
        );
      }
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].replace(/\*\*/g, "");
      const style = level === 1 ? "Title" : `Heading${Math.min(level, 3)}`;
      sawTitle = sawTitle || level === 1;
      paragraphs.push(paragraphXml([{ text, bold: false }], style));
      continue;
    }

    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      paragraphs.push(paragraphXml(inlineRuns(`- ${bullet[1]}`), "ListParagraph"));
      continue;
    }

    paragraphs.push(paragraphXml(inlineRuns(line), undefined));
  }

  if (!sawTitle) {
    paragraphs.unshift(paragraphXml([{ text: fallbackTitle, bold: false }], "Title"));
  }

  return { bodyXml: paragraphs.join("\n"), relationships };
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function relationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRelationshipsXml(relationships) {
  const items = relationships
    .map(
      (relationship) =>
        `  <Relationship Id="${relationship.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${relationship.target}"/>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${items}
</Relationships>`;
}

function documentXml(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr>
    <w:pPr><w:spacing w:after="160"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:sz w:val="40"/></w:rPr>
    <w:pPr><w:spacing w:after="360"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:rPr><w:b/><w:sz w:val="30"/></w:rPr>
    <w:pPr><w:spacing w:before="280" w:after="160"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
    <w:pPr><w:spacing w:before="220" w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:pPr><w:ind w:left="360"/><w:spacing w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Code">
    <w:name w:val="Code"/>
    <w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr>
    <w:pPr><w:spacing w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Caption">
    <w:name w:val="Caption"/>
    <w:rPr><w:i/><w:color w:val="666666"/><w:sz w:val="20"/></w:rPr>
    <w:pPr><w:spacing w:after="160"/></w:pPr>
  </w:style>
</w:styles>`;
}

function writeDocx({ source, output, title }) {
  const sourcePath = path.join(rootDir, source);
  const outputPath = path.join(rootDir, output);
  const stageDir = path.join(tempRoot, path.basename(output, ".docx"));
  const zipPath = `${outputPath}.zip`;

  rmSync(stageDir, { recursive: true, force: true });
  rmSync(outputPath, { force: true });
  rmSync(zipPath, { force: true });

  mkdirSync(path.join(stageDir, "_rels"), { recursive: true });
  mkdirSync(path.join(stageDir, "word"), { recursive: true });
  mkdirSync(path.join(stageDir, "word", "_rels"), { recursive: true });
  mkdirSync(path.join(stageDir, "word", "media"), { recursive: true });

  const markdown = readFileSync(sourcePath, "utf8");
  const { bodyXml, relationships } = markdownToParagraphs(
    markdown,
    title,
    path.dirname(sourcePath),
    path.join(stageDir, "word", "media"),
  );

  writeFileSync(path.join(stageDir, "[Content_Types].xml"), contentTypesXml(), "utf8");
  writeFileSync(path.join(stageDir, "_rels", ".rels"), relationshipsXml(), "utf8");
  writeFileSync(path.join(stageDir, "word", "_rels", "document.xml.rels"), documentRelationshipsXml(relationships), "utf8");
  writeFileSync(path.join(stageDir, "word", "document.xml"), documentXml(bodyXml), "utf8");
  writeFileSync(path.join(stageDir, "word", "styles.xml"), stylesXml(), "utf8");

  const command = [
    `$items = Get-ChildItem -LiteralPath ${psQuote(stageDir)}`,
    `Compress-Archive -LiteralPath $items.FullName -DestinationPath ${psQuote(zipPath)} -Force`,
    `Move-Item -LiteralPath ${psQuote(zipPath)} -Destination ${psQuote(outputPath)} -Force`,
  ].join("; ");

  execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: rootDir,
    stdio: "pipe",
  });

  console.log(`Created ${output}`);
}

const requestedIds = new Set(process.argv.slice(2));
const selectedDocuments = requestedIds.size
  ? documents.filter((document) => requestedIds.has(document.id))
  : documents;

if (selectedDocuments.length === 0) {
  throw new Error(`No document matched: ${Array.from(requestedIds).join(", ")}`);
}

rmSync(tempRoot, { recursive: true, force: true });
for (const document of selectedDocuments) {
  writeDocx(document);
}
rmSync(tempRoot, { recursive: true, force: true });
