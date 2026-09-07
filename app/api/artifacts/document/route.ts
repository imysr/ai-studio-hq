import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { isApiOwnerAuthenticated } from "@/lib/auth/apiOwner";

type ArtifactFormat = "pdf" | "docx";

type ArtifactRequest = {
  format?: ArtifactFormat;
  title?: string;
  subtitle?: string;
  content?: string;
  author?: string;
};

function sanitizeFilename(value: string) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned.slice(0, 90) || "MPA_Deliverable";
}

function cleanPdfText(value: string) {
  return value.replace(/[^\x20-\x7E\n\r\t]/g, "").replace(/\t/g, "    ");
}

function splitIntoParagraphs(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function createDocxParagraph(block: string) {
  const headingMatch = block.match(/^(#{1,3})\s+([\s\S]+)$/);

  if (headingMatch && !headingMatch[2].includes("\n")) {
    const level =
      headingMatch[1].length === 1
        ? HeadingLevel.HEADING_1
        : headingMatch[1].length === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;

    return new Paragraph({
      text: headingMatch[2].trim(),
      heading: level,
      spacing: { before: 220, after: 120 },
    });
  }

  const lines = block.split("\n");
  const bulletOnly = lines.every((line) => /^[-*]\s+/.test(line.trim()));

  if (bulletOnly) {
    return lines.map(
      (line) =>
        new Paragraph({
          text: line.trim().replace(/^[-*]\s+/, ""),
          bullet: { level: 0 },
          spacing: { after: 80 },
        }),
    );
  }

  return new Paragraph({
    children: [
      new TextRun({
        text: block.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1"),
      }),
    ],
    spacing: { after: 160 },
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function generateDocx({
  title,
  subtitle,
  content,
  author,
}: Required<Omit<ArtifactRequest, "format">>) {
  const bodyChildren = splitIntoParagraphs(content).flatMap((block) => {
    const result = createDocxParagraph(block);
    return Array.isArray(result) ? result : [result];
  });

  const document = new Document({
    creator: author,
    title,
    description: subtitle,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "Millennial Professional Academy",
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 120 },
          }),
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: subtitle,
                italics: true,
              }),
            ],
            spacing: { after: 300 },
          }),
          ...bodyChildren,
          new Paragraph({
            children: [
              new TextRun({
                text: `Prepared by ${author} • MPA AI Agent`,
                italics: true,
              }),
            ],
            spacing: { before: 360 },
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}

function wrapPdfText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);

    if (width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    let fragment = "";

    for (const character of word) {
      const next = fragment + character;

      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        fragment = next;
      } else {
        if (fragment) {
          lines.push(fragment);
        }
        fragment = character;
      }
    }

    current = fragment;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

async function generatePdf({
  title,
  subtitle,
  content,
  author,
}: Required<Omit<ArtifactRequest, "format">>) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin) {
      addPage();
    }
  };

  const drawWrapped = (
    value: string,
    options: {
      size: number;
      lineHeight: number;
      bold?: boolean;
      spacingAfter?: number;
    },
  ) => {
    const font = options.bold ? boldFont : regularFont;
    const safeText = cleanPdfText(value);
    const lines = wrapPdfText(safeText, font, options.size, contentWidth);

    for (const line of lines) {
      ensureSpace(options.lineHeight);
      page.drawText(line, {
        x: margin,
        y,
        size: options.size,
        font,
        color: rgb(0.12, 0.12, 0.14),
      });
      y -= options.lineHeight;
    }

    y -= options.spacingAfter ?? 8;
  };

  drawWrapped("MILLIENNIAL PROFESSIONAL ACADEMY", {
    size: 9,
    lineHeight: 13,
    bold: true,
    spacingAfter: 12,
  });

  drawWrapped(title, {
    size: 20,
    lineHeight: 25,
    bold: true,
    spacingAfter: 8,
  });

  drawWrapped(subtitle, {
    size: 10,
    lineHeight: 14,
    spacingAfter: 20,
  });

  const blocks = splitIntoParagraphs(content);

  for (const block of blocks) {
    const heading = block.match(/^(#{1,3})\s+([\s\S]+)$/);

    if (heading && !heading[2].includes("\n")) {
      drawWrapped(heading[2].trim(), {
        size: heading[1].length === 1 ? 16 : heading[1].length === 2 ? 14 : 12,
        lineHeight: 20,
        bold: true,
        spacingAfter: 8,
      });
      continue;
    }

    const lines = block.split("\n");

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();

      if (!trimmed) {
        y -= 6;
        continue;
      }

      const isBullet = /^[-*]\s+/.test(trimmed);
      const text = trimmed
        .replace(/^[-*]\s+/, isBullet ? "- " : "")
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1");

      drawWrapped(text, {
        size: 10.5,
        lineHeight: 15,
        bold: /^#{1,6}\s+/.test(trimmed),
        spacingAfter: 4,
      });
    }

    y -= 5;
  }

  ensureSpace(35);
  y -= 15;

  drawWrapped(`Prepared by ${author} | MPA AI Agent`, {
    size: 8.5,
    lineHeight: 12,
    spacingAfter: 0,
  });

  return pdf.save();
}

export async function POST(request: Request) {
  const authenticated = await isApiOwnerAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ArtifactRequest;

    const format = body.format;
    const title = body.title?.trim() ?? "";
    const subtitle = body.subtitle?.trim() || "MPA AI Agent Deliverable";
    const content = body.content?.trim() ?? "";
    const author = body.author?.trim() || "MPA AI Agent";

    if (
      (format !== "pdf" && format !== "docx") ||
      !title ||
      !content ||
      title.length > 250 ||
      subtitle.length > 500 ||
      author.length > 120 ||
      content.length > 120_000
    ) {
      return NextResponse.json(
        { error: "Invalid artifact request." },
        { status: 400 },
      );
    }

    const filenameBase = sanitizeFilename(title);

    if (format === "docx") {
      const buffer = await generateDocx({
        title,
        subtitle,
        content,
        author,
      });

      return new Response(toArrayBuffer(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filenameBase}.docx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const bytes = await generatePdf({
      title,
      subtitle,
      content,
      author,
    });

    return new Response(toArrayBuffer(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("MPA artifact generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate MPA artifact." },
      { status: 500 },
    );
  }
}
