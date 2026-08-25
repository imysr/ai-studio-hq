import { NextResponse } from "next/server";
import { isApiOwnerAuthenticated } from "@/lib/auth/apiOwner";
import { checkAIServerRateLimit } from "@/lib/aiServerRateLimit";

type CompletedTaskInput = {
  title: string;
  description: string;
  assignedAgent: number;
  agentName: string;
  result: string;
};

const RETRY_DELAYS = [3000, 8000, 15000];

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: Request) {
  try {
    const rateLimit = checkAIServerRateLimit();

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "AI request rate limit reached. Please try again shortly.",

          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,

          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
    const authenticated = await isApiOwnerAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }
    const body = await request.json();

    const missionTitle =
      typeof body?.missionTitle === "string" ? body.missionTitle.trim() : "";

    const missionDescription =
      typeof body?.missionDescription === "string"
        ? body.missionDescription.trim()
        : "";

    const completedTasks: CompletedTaskInput[] = Array.isArray(
      body?.completedTasks,
    )
      ? body.completedTasks
      : [];

    if (missionTitle.length === 0 || missionTitle.length > 200) {
      return NextResponse.json(
        {
          error: "Mission title must be between 1 and 200 characters.",
        },
        {
          status: 400,
        },
      );
    }

    if (missionDescription.length > 5000) {
      return NextResponse.json(
        {
          error: "Mission description must be 5000 characters or fewer.",
        },
        {
          status: 400,
        },
      );
    }

    if (completedTasks.length === 0 || completedTasks.length > 20) {
      return NextResponse.json(
        {
          error: "Completed tasks must contain between 1 and 20 tasks.",
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

    const safeTasks = completedTasks
      .filter(
        (task) =>
          typeof task?.title === "string" &&
          task.title.trim().length > 0 &&
          task.title.trim().length <= 250 &&
          typeof task?.description === "string" &&
          task.description.length <= 10000 &&
          Number.isInteger(task?.assignedAgent) &&
          task.assignedAgent >= 1 &&
          task.assignedAgent <= 6 &&
          typeof task?.agentName === "string" &&
          task.agentName.trim().length > 0 &&
          task.agentName.trim().length <= 100 &&
          typeof task?.result === "string" &&
          task.result.trim().length > 0 &&
          task.result.length <= 50000,
      )
      .map((task) => ({
        title: task.title.trim(),

        description:
          typeof task.description === "string" ? task.description.trim() : "",

        assignedAgent:
          typeof task.assignedAgent === "number" ? task.assignedAgent : 0,

        agentName:
          typeof task.agentName === "string"
            ? task.agentName.trim()
            : "AI Agent",

        result: task.result.trim(),
      }));

    if (safeTasks.length === 0) {
      return NextResponse.json(
        {
          error: "No usable completed task results were provided.",
        },
        {
          status: 400,
        },
      );
    }

    const prompt = buildFinalReviewPrompt(
      missionTitle,
      missionDescription,
      safeTasks,
    );

    const finalDeliverable = await requestFinalReview(apiKey, prompt);

    return NextResponse.json({
      success: true,
      finalDeliverable,
    });
  } catch (error) {
    console.error("Valid final review error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Valid failed to create the final mission review.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 503,
      },
    );
  }
}

/*
  VALID FINAL REVIEW REQUEST

  Includes automatic retries for
  temporary Gemini availability issues.
*/

async function requestFinalReview(
  apiKey: string,
  prompt: string,
): Promise<string> {
  let lastError: Error | null = null;

  const totalAttempts = RETRY_DELAYS.length + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
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
              temperature: 0.4,

              maxOutputTokens: 2600,
            },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message =
          data?.error?.message ?? "Valid failed to create the final review.";

        if (!RETRYABLE_STATUS_CODES.includes(response.status)) {
          throw new PermanentReviewError(message);
        }

        throw new Error(message);
      }

      const result =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("\n")
          .trim() ?? "";

      if (!result) {
        throw new Error("Valid returned an empty final review.");
      }

      return result;
    } catch (error) {
      if (error instanceof PermanentReviewError) {
        throw error;
      }

      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown final review error.");

      if (attempt >= RETRY_DELAYS.length) {
        break;
      }

      const delay = RETRY_DELAYS[attempt];

      console.warn(
        `Valid final review failed. Automatic retry ${
          attempt + 1
        }/${RETRY_DELAYS.length} in ${delay}ms.`,
        lastError,
      );

      await wait(delay);
    }
  }

  throw lastError ?? new Error("Valid failed to create the final review.");
}

class PermanentReviewError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "PermanentReviewError";
  }
}

/*
  FINAL REVIEW PROMPT
*/

function buildFinalReviewPrompt(
  missionTitle: string,
  missionDescription: string,
  completedTasks: CompletedTaskInput[],
): string {
  const teamWork = completedTasks
    .map((task, index) =>
      `
TEAM RESULT ${index + 1}

Agent:
${task.agentName}

Task:
${task.title}

Task Instructions:
${task.description || "No additional instructions."}

Completed Work:
${task.result}
        `.trim(),
    )
    .join("\n\n========================================\n\n");

  return `
You are Valid, the CEO and final reviewer of AI Studio HQ.

A company mission has now been completed by several specialist AI agents.

Your responsibility is to review all completed specialist work and produce one coherent final mission deliverable for the CEO.

MISSION TITLE:
${missionTitle}

MISSION DESCRIPTION:
${missionDescription || "No additional mission description was provided."}


COMPLETED TEAM WORK:

${teamWork}


YOUR JOB:

Review the specialist outputs as one complete body of work.

Do not simply paste or repeat each agent's report.

Identify:
- what was accomplished
- the strongest useful conclusions
- whether the specialist outputs align with each other
- important gaps or inconsistencies
- important risks
- whether the mission objective was satisfied
- what should happen next

Use the following structure:

## Mission Outcome
State whether the mission objective was achieved and summarize the overall result.

## Key Deliverables
Summarize the most important deliverables produced by the team.

## Team Integration
Explain how the specialist outputs work together.

## Gaps & Risks
Identify unresolved issues, missing work, contradictions, assumptions, or risks.

## CEO Assessment
Give Valid's overall judgment of the quality and usefulness of the completed work.

## Recommended Next Action
Give a clear, practical recommendation for what the company or user should do next.

Rules:
- Think like the CEO reviewing completed department work.
- Do not pretend unfinished work is complete.
- Do not invent results that the specialists did not provide.
- Clearly identify missing information.
- Resolve duplication by summarizing rather than repeating.
- Keep the final report coherent and practical.
- Do not assign new tasks automatically.
- Do not claim the product itself has been built unless the specialist work proves that.
- Complete the report within the output limit.
- Never stop in the middle of a sentence or unfinished section.
  `.trim();
}
