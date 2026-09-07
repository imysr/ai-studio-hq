import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

import { isApiOwnerAuthenticated } from "@/lib/auth/apiOwner";

type VisualFormat = "png" | "pptx";

type VisualRequest = {
  format?: VisualFormat;
  title?: string;
  content?: string;
  missionTitle?: string;
};

type PixelVisualSpec = {
  artifactType: "poster";
  platform: "instagram_portrait";
  courseLabel: string;
  headline: string;
  subheadline: string;
  benefits: string[];
  cta: string;
  date: string;
  registration: string;
  visualDirection: string;
};

type PosterContent = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  benefits: string[];
  cta: string;
  footer: string;
  courseLabel: string;
  date: string;
  registration: string;
  visualDirection: string;
};

const BRAND = {
  navy: "071426",
  blue: "0E2A56",
  brightBlue: "2F80ED",
  lightBlue: "8FC5FF",
  paleBlue: "D9ECFF",
  white: "FFFFFF",
  muted: "AFC4DF",
  green: "5E8B6E",
  orange: "F97316",
};

function sanitizeFilename(value: string) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned.slice(0, 90) || "MPA_Poster";
}

function cleanMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function getSection(content: string, names: string[]) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const normalized = lines[index]
      .replace(/^#{1,6}\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();

    const matchingName = names.find((name) => {
      const target = name.toLowerCase();
      return normalized === target || normalized.startsWith(`${target}:`);
    });

    if (!matchingName) {
      continue;
    }

    const inline = lines[index].split(":").slice(1).join(":").trim();

    if (inline) {
      return cleanMarkdown(inline);
    }

    const collected: string[] = [];

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const trimmed = line.trim();

      if (/^#{1,6}\s+/.test(trimmed)) {
        break;
      }

      if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed) && collected.length > 0) {
        break;
      }

      if (trimmed) {
        collected.push(trimmed);
      }

      if (collected.join(" ").length > 800) {
        break;
      }
    }

    if (collected.length > 0) {
      return cleanMarkdown(collected.join(" "));
    }
  }

  return "";
}

function shorten(value: string, max: number) {
  const cleaned = cleanMarkdown(value).replace(/\s+/g, " ").trim();

  if (cleaned.length <= max) {
    return cleaned;
  }

  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function prettifyMissionTitle(value: string) {
  return value
    .replace(/\bprepare\b/gi, "")
    .replace(/\btomorrow'?s\b/gi, "")
    .replace(/\bmarketing content\b/gi, "")
    .replace(/\bmarketing package\b/gi, "")
    .replace(/\bcreate\b/gi, "")
    .replace(/\bdevelop\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, "")
    .trim();
}

function makeHeadline(
  taskTitle: string,
  missionTitle: string,
  content: string,
) {
  const explicit =
    getSection(content, [
      "Headline / Hook",
      "Headline",
      "Primary Headline",
      "On-Visual Headline",
      "Hook",
    ]) || "";

  const internalTaskWords =
    /\b(develop|design|layout|aesthetic|visual direction|prepare|create|marketing content|marketing package)\b/i;

  if (
    explicit &&
    explicit.toLowerCase() !== taskTitle.toLowerCase() &&
    !internalTaskWords.test(explicit)
  ) {
    return explicit;
  }

  const combined = `${missionTitle} ${content}`.toLowerCase();

  if (combined.includes("beginner") && combined.includes("ai")) {
    return "AI Looks Complicated. Start Simple.";
  }

  if (combined.includes("ai")) {
    return "Turn AI Into a Skill You Can Actually Use.";
  }

  const onVisual = getSection(content, [
    "On-Visual Copy",
    "Poster Copy",
    "Carousel / Poster Copy",
  ]);

  if (onVisual) {
    const firstSentence = onVisual.split(/[.!?]/)[0]?.trim();

    if (firstSentence && !internalTaskWords.test(firstSentence)) {
      return firstSentence;
    }
  }

  return "Learn Something Useful. Use It for Real.";
}

function makeCourseLabel(missionTitle: string, content: string) {
  const audience = getSection(content, ["Audience & Level", "Target Audience"]);
  const combined = `${missionTitle} ${content}`.toLowerCase();

  if (combined.includes("beginner")) {
    return "BEGINNER FRIENDLY";
  }

  if (audience) {
    return shorten(audience.toUpperCase(), 34);
  }

  return "MPA PROFESSIONAL LEARNING";
}

function extractVisualSpec(content: string): PixelVisualSpec | null {
  const markerIndex = content.indexOf("## MPA_VISUAL_SPEC");

  if (markerIndex === -1) {
    return null;
  }

  const afterMarker = content.slice(markerIndex);
  const fenced = afterMarker.match(/```json\s*([\s\S]*?)```/i);

  if (!fenced?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(fenced[1]) as Partial<PixelVisualSpec>;

    if (
      parsed.artifactType !== "poster" ||
      parsed.platform !== "instagram_portrait" ||
      typeof parsed.courseLabel !== "string" ||
      typeof parsed.headline !== "string" ||
      typeof parsed.subheadline !== "string" ||
      !Array.isArray(parsed.benefits) ||
      parsed.benefits.length !== 3 ||
      parsed.benefits.some((item) => typeof item !== "string") ||
      typeof parsed.cta !== "string" ||
      typeof parsed.date !== "string" ||
      typeof parsed.registration !== "string" ||
      typeof parsed.visualDirection !== "string"
    ) {
      return null;
    }

    return {
      artifactType: "poster",
      platform: "instagram_portrait",
      courseLabel: shorten(parsed.courseLabel, 42),
      headline: shorten(parsed.headline, 92),
      subheadline: shorten(parsed.subheadline, 190),
      benefits: parsed.benefits.map((item) => shorten(item, 62)),
      cta: shorten(parsed.cta, 54),
      date: shorten(parsed.date, 40),
      registration: shorten(parsed.registration, 58),
      visualDirection: shorten(parsed.visualDirection, 240),
    };
  } catch {
    return null;
  }
}

function knownCourseName(missionTitle: string) {
  const cleaned = missionTitle
    .replace(/^\s*(promote|create|prepare|design|advertise|market)\s+/i, "")
    .trim();

  const courseMatch = cleaned.match(/(?:MPA\s+)?(.+?\bCourse)\b/i);

  if (!courseMatch?.[0]) {
    return "";
  }

  return courseMatch[0].trim();
}

function stripUnsupportedPlaceholders(value: string) {
  return value
    .replace(
      /\[(?:DURATION(?:\/WEEKS)?|WEEKS?|HOURS?|KEYWORD|COURSE NAME)\]/gi,
      "",
    )
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([—–-])\s*$/g, "")
    .trim();
}

function hasUnsupportedPlaceholder(value: string) {
  return /\[(?:DURATION(?:\/WEEKS)?|WEEKS?|HOURS?|KEYWORD|COURSE NAME)\]/i.test(
    value,
  );
}

function safeHeadline(value: string, courseName: string) {
  let result = value;

  if (courseName) {
    result = result.replace(/\[COURSE NAME\]/gi, courseName);
  }

  if (hasUnsupportedPlaceholder(result)) {
    result = stripUnsupportedPlaceholders(result);
  }

  if (!result || result.length < 5) {
    return "Start Learning AI Without the Tech Jargon";
  }

  return shorten(result, 72);
}

function safeSubheadline(value: string) {
  if (
    hasUnsupportedPlaceholder(value) ||
    /\b(duration|weeks?|hours?)\b/i.test(value)
  ) {
    return "Start from the basics and learn practical AI in a clear, beginner-friendly way.";
  }

  const cleaned = stripUnsupportedPlaceholders(value);

  return shorten(
    cleaned ||
      "Practical, beginner-friendly learning designed to make AI easier to understand and use.",
    145,
  );
}

function safeBenefits(values: string[]) {
  const cleaned = values
    .map((item) => stripUnsupportedPlaceholders(item))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => shorten(item, 34));

  const defaults = [
    "Understand the basics",
    "Explore practical AI uses",
    "Build confidence step by step",
  ];

  while (cleaned.length < 3) {
    cleaned.push(defaults[cleaned.length]);
  }

  return cleaned;
}

function safeCta(value: string) {
  const invalid =
    !value ||
    value.length > 28 ||
    hasUnsupportedPlaceholder(value) ||
    /\b(comment|keyword|link in bio|dm|message us)\b/i.test(value);

  if (invalid) {
    return "Register / Learn More";
  }

  return shorten(stripUnsupportedPlaceholders(value), 28);
}

function normalizePixelSpec(
  spec: PixelVisualSpec,
  missionTitle: string,
): PixelVisualSpec {
  const courseName = knownCourseName(missionTitle);

  let courseLabel = spec.courseLabel;

  if (courseName) {
    courseLabel = courseLabel.replace(/\[COURSE NAME\]/gi, courseName);
  }

  courseLabel = stripUnsupportedPlaceholders(courseLabel);

  if (!courseLabel || /\b(beginner friendly)\b/i.test(courseLabel)) {
    courseLabel = courseName || "Beginner AI Course";
  }

  return {
    ...spec,
    courseLabel: shorten(courseLabel, 34),
    headline: safeHeadline(spec.headline, courseName),
    subheadline: safeSubheadline(spec.subheadline),
    benefits: safeBenefits(spec.benefits),
    cta: safeCta(spec.cta),
    date:
      spec.date && !hasUnsupportedPlaceholder(spec.date)
        ? shorten(spec.date, 32)
        : "[COURSE DATE]",
    registration:
      spec.registration && !hasUnsupportedPlaceholder(spec.registration)
        ? shorten(spec.registration, 44)
        : "[REGISTRATION LINK]",
    visualDirection: shorten(
      stripUnsupportedPlaceholders(spec.visualDirection) ||
        "Modern professional MPA visual using typography, shapes, icons, and brand assets.",
      220,
    ),
  };
}

function runPosterPreflight(poster: PosterContent): PosterContent {
  const headline = safeHeadline(poster.headline, "");
  const subheadline = safeSubheadline(poster.subheadline);
  const benefits = safeBenefits(poster.benefits);
  const cta = safeCta(poster.cta);

  return {
    ...poster,
    headline,
    subheadline,
    benefits,
    cta,
    courseLabel:
      stripUnsupportedPlaceholders(poster.courseLabel) || "Beginner AI Course",
    date:
      poster.date && !hasUnsupportedPlaceholder(poster.date)
        ? poster.date
        : "[COURSE DATE]",
    registration:
      poster.registration && !hasUnsupportedPlaceholder(poster.registration)
        ? poster.registration
        : "[REGISTRATION LINK]",
    footer: "Millennial Professional Academy",
  };
}

function extractPosterContent(
  taskTitle: string,
  content: string,
  missionTitle: string,
): PosterContent {
  const rawSpec = extractVisualSpec(content);
  const spec = rawSpec ? normalizePixelSpec(rawSpec, missionTitle) : null;

  if (spec) {
    return runPosterPreflight({
      eyebrow: "MILLIENNIAL PROFESSIONAL ACADEMY",
      headline: spec.headline,
      subheadline: spec.subheadline,
      benefits: spec.benefits,
      cta: spec.cta,
      footer: "Millennial Professional Academy",
      courseLabel: spec.courseLabel,
      date: spec.date,
      registration: spec.registration,
      visualDirection: spec.visualDirection,
    });
  }

  const headline = makeHeadline(taskTitle, missionTitle, content);

  const onVisual = getSection(content, [
    "On-Visual Copy",
    "Poster Copy",
    "Carousel / Poster Copy",
    "Supporting Copy",
    "Subheadline",
  ]);

  const caption = getSection(content, ["Caption", "Post Caption"]);
  const goal = getSection(content, ["Content Goal", "Campaign Angle"]);

  const combined = `${missionTitle} ${content}`.toLowerCase();
  const isBeginnerAi = combined.includes("beginner") && combined.includes("ai");

  const subheadline =
    (onVisual &&
    !/\b(develop|design|layout|visual direction|aesthetic)\b/i.test(onVisual)
      ? onVisual
      : "") ||
    goal ||
    (isBeginnerAi
      ? "A beginner-friendly introduction to using AI practically — without needing a technical background."
      : "") ||
    caption ||
    "Practical learning designed to turn new knowledge into useful skills.";

  const fallbackBenefits = isBeginnerAi
    ? [
        "Understand the basics",
        "Learn practical uses",
        "Build confidence step by step",
      ]
    : ["Clear guidance", "Practical examples", "Skills you can use"];

  const cta =
    getSection(content, ["CTA", "Call to Action"]) || "Register / Learn More";

  return runPosterPreflight({
    eyebrow: "MILLIENNIAL PROFESSIONAL ACADEMY",
    headline: shorten(headline, 92),
    subheadline: shorten(subheadline, 190),
    benefits: fallbackBenefits,
    cta: shorten(cta, 54),
    footer: "Millennial Professional Academy",
    courseLabel: makeCourseLabel(missionTitle, content),
    date: "[COURSE DATE]",
    registration: "[REGISTRATION LINK]",
    visualDirection: shorten(
      getSection(content, ["Visual Brief", "Visual Direction"]) ||
        "Modern professional MPA visual using typography, shapes, icons, and brand assets.",
      240,
    ),
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function splitLines(value: string, maxChars: number, maxLines: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  const used = lines.join(" ").length;

  if (used < value.length && lines.length > 0) {
    lines[lines.length - 1] =
      `${lines[lines.length - 1].replace(/[.,;:!?]*$/, "")}…`;
  }

  return lines;
}

async function getLogoDataUri() {
  const logoPath = path.join(
    process.cwd(),
    "public",
    "branding",
    "mpa-logo.png",
  );

  const bytes = await fs.readFile(logoPath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function buildPosterSvg(poster: PosterContent, logoDataUri: string) {
  const headlineLines = splitLines(poster.headline, 19, 4);
  const subLines = splitLines(poster.subheadline, 37, 4);
  const benefitLines = poster.benefits.map((benefit) =>
    splitLines(benefit, 30, 2),
  );

  const headlineStartY = 360;
  const headlineSvg = headlineLines
    .map(
      (line, index) =>
        `<text x="76" y="${headlineStartY + index * 84}" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="800" fill="#FFFFFF">${escapeXml(line)}</text>`,
    )
    .join("");

  const subStart = headlineStartY + headlineLines.length * 84 + 44;

  const subSvg = subLines
    .map(
      (line, index) =>
        `<text x="78" y="${subStart + index * 43}" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="500" fill="#D9ECFF">${escapeXml(line)}</text>`,
    )
    .join("");

  const benefitsStart = subStart + subLines.length * 43 + 54;
  const benefitCardWidth = 286;
  const benefitGap = 14;

  const benefitsSvg = poster.benefits
    .map((benefit, index) => {
      const x = 75 + index * (benefitCardWidth + benefitGap);
      const lines = benefitLines[index] ?? [benefit];

      const text = lines
        .map(
          (line, lineIndex) =>
            `<text x="${x + 55}" y="${benefitsStart + 47 + lineIndex * 28}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">${escapeXml(line)}</text>`,
        )
        .join("");

      return `
        <rect x="${x}" y="${benefitsStart}" width="${benefitCardWidth}" height="105" rx="22" fill="#FFFFFF" fill-opacity="0.065" stroke="#FFFFFF" stroke-opacity="0.14"/>
        <circle cx="${x + 30}" cy="${benefitsStart + 38}" r="12" fill="#2F80ED"/>
        <path d="M${x + 23} ${benefitsStart + 38} L${x + 28} ${benefitsStart + 43} L${x + 37} ${benefitsStart + 32}" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${text}
      `;
    })
    .join("");

  const ctaY = Math.min(1120, benefitsStart + 145);

  return `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#061120"/>
        <stop offset="55%" stop-color="#0A2347"/>
        <stop offset="100%" stop-color="#123F83"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#D9ECFF"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0%" stop-color="#2F80ED" stop-opacity="0.50"/>
        <stop offset="100%" stop-color="#2F80ED" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
    </defs>

    <rect width="1080" height="1350" fill="url(#bg)"/>

    <circle cx="970" cy="230" r="360" fill="url(#glow)"/>
    <circle cx="938" cy="238" r="145" fill="none" stroke="#78B7FF" stroke-opacity="0.24" stroke-width="2"/>
    <circle cx="938" cy="238" r="96" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="2"/>

    <path d="M805 115 C860 165 860 260 926 309 C965 338 1015 352 1080 346" fill="none" stroke="#8FC5FF" stroke-opacity="0.22" stroke-width="2"/>
    <path d="M828 84 C902 132 910 204 964 248 C1004 281 1035 288 1080 286" fill="none" stroke="#FFFFFF" stroke-opacity="0.10" stroke-width="2"/>

    <circle cx="852" cy="142" r="7" fill="#8FC5FF"/>
    <circle cx="928" cy="311" r="6" fill="#FFFFFF" fill-opacity="0.75"/>
    <circle cx="1001" cy="279" r="5" fill="#8FC5FF"/>

    <rect x="66" y="58" width="948" height="1234" rx="38" fill="none" stroke="#FFFFFF" stroke-opacity="0.10"/>

    <rect x="75" y="79" width="290" height="118" rx="20" fill="#FFFFFF" fill-opacity="0.96" filter="url(#shadow)"/>
    <image href="${logoDataUri}" x="93" y="91" width="254" height="94" preserveAspectRatio="xMidYMid meet"/>

    <rect x="75" y="235" width="245" height="48" rx="24" fill="#2F80ED" fill-opacity="0.22" stroke="#8FC5FF" stroke-opacity="0.45"/>
    <text x="197.5" y="266" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" letter-spacing="1.4" fill="#D9ECFF">${escapeXml(poster.courseLabel)}</text>

    ${headlineSvg}
    ${subSvg}
    ${benefitsSvg}


    <rect x="75" y="${ctaY}" width="585" height="92" rx="25" fill="url(#cta)" filter="url(#shadow)"/>
    <text x="367.5" y="${ctaY + 58}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" fill="#0A2347">${escapeXml(poster.cta)}</text>

    <rect x="75" y="${ctaY + 116}" width="585" height="70" rx="18" fill="#FFFFFF" fill-opacity="0.055" stroke="#FFFFFF" stroke-opacity="0.11"/>
    <text x="101" y="${ctaY + 145}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#8FC5FF">COURSE DATE</text>
    <text x="101" y="${ctaY + 172}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">${escapeXml(poster.date)}</text>
    <line x1="342" y1="${ctaY + 129}" x2="342" y2="${ctaY + 174}" stroke="#FFFFFF" stroke-opacity="0.14"/>
    <text x="371" y="${ctaY + 145}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#8FC5FF">REGISTRATION</text>
    <text x="371" y="${ctaY + 172}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">${escapeXml(poster.registration)}</text>

    <line x1="75" y1="1235" x2="1005" y2="1235" stroke="#8FC5FF" stroke-opacity="0.25"/>
    <text x="75" y="1278" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#AFC4DF">${escapeXml(poster.footer)}</text>
    <text x="1005" y="1278" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">MILLENNIAL PROFESSIONAL ACADEMY</text>
  </svg>`;
}

async function generatePng(poster: PosterContent) {
  const logoDataUri = await getLogoDataUri();
  const svg = buildPosterSvg(poster, logoDataUri);

  return sharp(Buffer.from(svg)).png({ quality: 96 }).toBuffer();
}

function addPptxBrandDecor(slide: PptxGenJS.Slide, pptx: PptxGenJS) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 10.25,
    y: -0.8,
    w: 4.2,
    h: 4.2,
    fill: { color: BRAND.brightBlue, transparency: 66 },
    line: { color: BRAND.brightBlue, transparency: 100 },
  });

  slide.addShape(pptx.ShapeType.ellipse, {
    x: 10.7,
    y: 0.25,
    w: 1.65,
    h: 1.65,
    fill: { color: BRAND.navy, transparency: 100 },
    line: { color: BRAND.lightBlue, transparency: 70, width: 1.3 },
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 9.55,
    y: 0.25,
    w: 2.1,
    h: 1.1,
    line: { color: BRAND.lightBlue, transparency: 70, width: 1.1 },
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 10.2,
    y: 1.0,
    w: 2.2,
    h: 0.8,
    line: { color: BRAND.white, transparency: 83, width: 1 },
  });
}

async function generatePptx(poster: PosterContent) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MPA AI Agent - Pixel";
  pptx.company = "Millennial Professional Academy";
  pptx.subject = "Editable MPA marketing visual";
  pptx.title = poster.headline;
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  const slide = pptx.addSlide();
  slide.background = { color: BRAND.navy };
  addPptxBrandDecor(slide, pptx);

  const logoPath = path.join(
    process.cwd(),
    "public",
    "branding",
    "mpa-logo.png",
  );

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 0.38,
    w: 3.0,
    h: 1.08,
    fill: { color: BRAND.white, transparency: 2 },
    line: { color: BRAND.white, transparency: 100 },
  });

  slide.addImage({
    path: logoPath,
    x: 0.78,
    y: 0.49,
    w: 2.64,
    h: 0.86,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.62,
    y: 1.68,
    w: 2.7,
    h: 0.38,
    fill: { color: BRAND.brightBlue, transparency: 72 },
    line: { color: BRAND.lightBlue, transparency: 60, width: 1 },
  });

  slide.addText(poster.courseLabel, {
    x: 0.78,
    y: 1.78,
    w: 2.36,
    h: 0.14,
    fontSize: 8.5,
    bold: true,
    color: BRAND.paleBlue,
    charSpacing: 1.2,
    align: "center",
    margin: 0,
    fit: "shrink",
  });

  slide.addText(poster.headline, {
    x: 0.64,
    y: 2.32,
    w: 8.3,
    h: 1.75,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: BRAND.white,
    fit: "shrink",
    margin: 0,
    valign: "middle",
  });

  slide.addText(poster.subheadline, {
    x: 0.66,
    y: 4.13,
    w: 7.8,
    h: 0.9,
    fontSize: 16.5,
    color: BRAND.paleBlue,
    fit: "shrink",
    margin: 0,
    valign: "top",
  });

  poster.benefits.forEach((benefit, index) => {
    const x = 0.66 + index * 2.35;

    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 5.05,
      w: 2.15,
      h: 0.72,
      fill: { color: BRAND.white, transparency: 94 },
      line: { color: BRAND.white, transparency: 85, width: 1 },
    });

    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.16,
      y: 5.23,
      w: 0.28,
      h: 0.28,
      fill: { color: BRAND.brightBlue },
      line: { color: BRAND.brightBlue, transparency: 100 },
    });

    slide.addText("✓", {
      x: x + 0.17,
      y: 5.275,
      w: 0.26,
      h: 0.12,
      fontSize: 7.2,
      bold: true,
      color: BRAND.white,
      align: "center",
      margin: 0,
    });

    slide.addText(benefit, {
      x: x + 0.52,
      y: 5.19,
      w: 1.43,
      h: 0.3,
      fontSize: 9.2,
      bold: true,
      color: BRAND.white,
      margin: 0,
      fit: "shrink",
      valign: "middle",
    });
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.64,
    y: 6.0,
    w: 4.7,
    h: 0.66,
    fill: { color: BRAND.white },
    line: { color: BRAND.white, transparency: 100 },
  });

  slide.addText(poster.cta, {
    x: 0.92,
    y: 6.18,
    w: 4.14,
    h: 0.2,
    fontSize: 13,
    bold: true,
    color: BRAND.blue,
    margin: 0,
    fit: "shrink",
    align: "center",
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.64,
    y: 6.86,
    w: 6.9,
    h: 0.48,
    fill: { color: BRAND.white, transparency: 95 },
    line: { color: BRAND.white, transparency: 88, width: 1 },
  });

  slide.addText("COURSE DATE", {
    x: 0.88,
    y: 6.99,
    w: 1.0,
    h: 0.12,
    fontSize: 6.7,
    bold: true,
    color: BRAND.lightBlue,
    margin: 0,
  });

  slide.addText(poster.date, {
    x: 1.9,
    y: 6.97,
    w: 1.45,
    h: 0.15,
    fontSize: 7.7,
    bold: true,
    color: BRAND.white,
    margin: 0,
    fit: "shrink",
  });

  slide.addText("REGISTRATION", {
    x: 3.75,
    y: 6.99,
    w: 1.1,
    h: 0.12,
    fontSize: 6.7,
    bold: true,
    color: BRAND.lightBlue,
    margin: 0,
  });

  slide.addText(poster.registration, {
    x: 4.9,
    y: 6.97,
    w: 2.25,
    h: 0.15,
    fontSize: 7.7,
    bold: true,
    color: BRAND.white,
    margin: 0,
    fit: "shrink",
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 0.64,
    y: 7.43,
    w: 11.95,
    h: 0,
    line: { color: BRAND.lightBlue, transparency: 78, width: 1 },
  });

  slide.addText(poster.footer, {
    x: 0.66,
    y: 7.52,
    w: 9.2,
    h: 0.16,
    fontSize: 7.4,
    color: BRAND.muted,
    margin: 0,
    fit: "shrink",
  });

  slide.addText("MILLENNIAL PROFESSIONAL ACADEMY", {
    x: 10.15,
    y: 7.5,
    w: 2.35,
    h: 0.16,
    fontSize: 7.4,
    bold: true,
    color: BRAND.white,
    margin: 0,
    align: "right",
  });

  return pptx.write({ outputType: "nodebuffer" });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function POST(request: Request) {
  const authenticated = await isApiOwnerAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as VisualRequest;

    const format = body.format;
    const title = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    const missionTitle = body.missionTitle?.trim() ?? "";

    if (
      (format !== "png" && format !== "pptx") ||
      !title ||
      !content ||
      title.length > 250 ||
      missionTitle.length > 500 ||
      content.length > 120_000
    ) {
      return NextResponse.json(
        { error: "Invalid visual artifact request." },
        { status: 400 },
      );
    }

    const poster = extractPosterContent(title, content, missionTitle);
    const filenameBase = sanitizeFilename(`${poster.headline}_MPA_Pixel`);

    if (format === "png") {
      const buffer = await generatePng(poster);

      return new Response(toArrayBuffer(buffer), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filenameBase}.png"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const output = await generatePptx(poster);
    const buffer = Buffer.isBuffer(output)
      ? output
      : Buffer.from(output as ArrayBuffer);

    return new Response(toArrayBuffer(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filenameBase}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("MPA visual artifact generation failed:", error);

    if (error instanceof Error && error.message.includes("mpa-logo.png")) {
      return NextResponse.json(
        {
          error:
            "MPA logo is missing. Add public/branding/mpa-logo.png and try again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate MPA visual artifact." },
      { status: 500 },
    );
  }
}
