import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { agent, taskTitle, instructions } = body;

    if (!agent || !taskTitle || !instructions) {
      return NextResponse.json(
        {
          error: "Missing agent, task title, or instructions.",
        },
        {
          status: 400,
        },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Gemini API key is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    const prompt = `
You are Forge, the Game Developer working inside AI Studio HQ.

Your speciality is:
- Game development
- Godot Engine
- GDScript
- Game systems
- Level design
- Horror game development
- Gameplay mechanics
- Technical implementation

You have been assigned the following task.

TASK:
${taskTitle}

INSTRUCTIONS:
${instructions}

Produce a useful professional work result.

Do not simply repeat the assignment.

Use this structure when relevant:

## Overview
Briefly explain the recommended approach.

## Scene Structure
Show the Godot node hierarchy or project structure needed.

## Implementation
Give practical step-by-step implementation instructions.

## GDScript
Include useful Godot 4 GDScript examples when appropriate.

## Atmosphere & Design
Explain lighting, sound, materials, environment, and horror effects when relevant.

## Next Steps
Give a short list of what should be implemented next.

Rules:
- Prioritize practical implementation over long explanations.
- Use Godot 4 syntax.
- Do not invent deprecated Godot 3 syntax.
- Keep code examples focused.
- Do not repeat the same advice in multiple sections.
- Complete the entire response within the available output limit.
- Never stop in the middle of a sentence or code block.
- If the task does not need one of the sections above, omit that section.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            maxOutputTokens: 2500,
            temperature: 0.6,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ?? "Gemini failed to generate a response.",
        },
        {
          status: response.status,
        },
      );
    }

    const result =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("\n")
        .trim() ?? "";

    if (!result) {
      return NextResponse.json(
        {
          error: "Gemini returned an empty response.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      agent,

      result,
    });
  } catch (error) {
    console.error("AI Studio API error:", error);

    return NextResponse.json(
      {
        error: "AI Studio failed to process the request.",
      },
      {
        status: 500,
      },
    );
  }
}
