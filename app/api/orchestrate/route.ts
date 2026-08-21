import { NextResponse } from "next/server";

/*
  VALID — AI ORCHESTRATOR

  This API allows Valid to analyse a mission
  and decide which AI agents should work on it.

  Agent IDs:
  1 = Valid
  2 = CodeBot
  3 = Pixel
  4 = Sage
  5 = Atlas
  6 = Forge
*/

type DelegatedTask = {
  title: string;
  description: string;
  assignedAgent: number;
};

type OrchestrationResult = {
  analysis: string;
  tasks: DelegatedTask[];
};

const VALID_AGENT_IDS = [1, 2, 3, 4, 5, 6];

/*
  VALID ORCHESTRATION AUTO RETRY

  Initial request
  ↓
  503 / 429 / temporary server error
  ↓
  Wait 3 seconds
  ↓
  Retry 1
  ↓
  Wait 8 seconds
  ↓
  Retry 2
  ↓
  Wait 15 seconds
  ↓
  Retry 3
  ↓
  Still unavailable?
  ↓
  Return orchestration error to Mission Control
*/

const AUTO_RETRY_DELAYS = [3000, 8000, 15000];

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const missionTitle =
      typeof body?.missionTitle === "string" ? body.missionTitle.trim() : "";

    const missionDescription =
      typeof body?.missionDescription === "string"
        ? body.missionDescription.trim()
        : "";

    if (!missionTitle) {
      return NextResponse.json(
        {
          error: "Mission title is required.",
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

    const prompt = buildOrchestrationPrompt(missionTitle, missionDescription);

    /*
      CALL GEMINI WITH AUTOMATIC RETRY
    */

    const rawResult = await requestValidPlan(apiKey, prompt);

    if (!rawResult) {
      return NextResponse.json(
        {
          error: "Valid returned an empty orchestration result.",
        },
        {
          status: 500,
        },
      );
    }

    let parsedResult: unknown;

    try {
      parsedResult = JSON.parse(rawResult);
    } catch (error) {
      console.error(
        "Failed to parse Valid orchestration JSON:",
        rawResult,
        error,
      );

      return NextResponse.json(
        {
          error: "Valid returned invalid orchestration data.",
        },
        {
          status: 500,
        },
      );
    }

    if (!isValidOrchestrationResult(parsedResult)) {
      console.error("Invalid Valid orchestration structure:", parsedResult);

      return NextResponse.json(
        {
          error: "Valid returned an invalid mission plan.",
        },
        {
          status: 500,
        },
      );
    }

    /*
      ADDITIONAL SAFETY

      Never blindly trust AI-generated
      agent IDs or task contents.
    */

    const safeTasks = parsedResult.tasks
      .filter((task) => VALID_AGENT_IDS.includes(task.assignedAgent))
      .map((task) => ({
        title: task.title.trim(),

        description: task.description.trim(),

        assignedAgent: task.assignedAgent,
      }))
      .filter((task) => task.title.length > 0 && task.description.length > 0);

    if (safeTasks.length === 0) {
      return NextResponse.json(
        {
          error: "Valid did not create any usable mission tasks.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      analysis: parsedResult.analysis.trim(),

      tasks: safeTasks,
    });
  } catch (error) {
    console.error("Valid orchestration error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "AI Studio failed to orchestrate the mission.";

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
  GEMINI ORCHESTRATION REQUEST

  This performs the initial request
  plus up to three automatic retries.
*/

async function requestValidPlan(
  apiKey: string,
  prompt: string,
): Promise<string> {
  let lastError: Error | null = null;

  const totalAttempts = AUTO_RETRY_DELAYS.length + 1;

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
              temperature: 0.3,

              maxOutputTokens: 2000,

              responseMimeType: "application/json",
            },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message =
          data?.error?.message ?? "Valid failed to analyse the mission.";

        /*
          Do NOT retry permanent errors
          such as bad requests or invalid
          authentication.
        */

        if (!RETRYABLE_STATUS_CODES.includes(response.status)) {
          throw new PermanentOrchestrationError(message);
        }

        throw new Error(message);
      }

      const rawResult =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("")
          .trim() ?? "";

      if (!rawResult) {
        throw new Error("Valid returned an empty orchestration result.");
      }

      /*
        SUCCESS
      */

      if (attempt > 0) {
        console.log(`Valid orchestration succeeded on attempt ${attempt + 1}.`);
      }

      return rawResult;
    } catch (error) {
      /*
        Permanent errors should not
        waste API requests by retrying.
      */

      if (error instanceof PermanentOrchestrationError) {
        throw error;
      }

      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown Valid orchestration error.");

      /*
        No retries remain.
      */

      if (attempt >= AUTO_RETRY_DELAYS.length) {
        break;
      }

      const retryNumber = attempt + 1;

      const delay = AUTO_RETRY_DELAYS[attempt];

      console.warn(
        `Valid orchestration failed. Automatic retry ${retryNumber}/${AUTO_RETRY_DELAYS.length} in ${delay}ms.`,
        lastError,
      );

      await wait(delay);
    }
  }

  throw lastError ?? new Error("Valid failed to analyse the mission.");
}

/*
  PERMANENT ERROR

  Used so things such as invalid API
  requests do not trigger unnecessary
  automatic retries.
*/

class PermanentOrchestrationError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "PermanentOrchestrationError";
  }
}

/*
  VALID ORCHESTRATION PROMPT
*/

function buildOrchestrationPrompt(
  missionTitle: string,
  missionDescription: string,
): string {
  return `
You are Valid, the CEO and AI Manager inside AI Studio HQ.

You manage a company containing six specialised AI agents.

AGENTS:

1 — Valid
Role:
CEO / AI Manager

Specialities:
- Mission analysis
- Planning
- Coordination
- Breaking large objectives into smaller tasks
- Reviewing team strategy


2 — CodeBot
Role:
Software Developer

Specialities:
- Programming
- Next.js
- React
- TypeScript
- JavaScript
- APIs
- Supabase
- Databases
- Debugging
- Application architecture
- Git and GitHub


3 — Pixel
Role:
UI/UX Designer

Specialities:
- UI/UX
- Web design
- Mobile design
- Layout
- Typography
- Design systems
- Accessibility
- Responsive interfaces
- Developer handoff


4 — Sage
Role:
Learning Specialist

Specialities:
- Education
- Course creation
- Lesson planning
- Beginner explanations
- Learning activities
- Quizzes
- Training materials


5 — Atlas
Role:
Business Strategist

Specialities:
- Business strategy
- Product strategy
- Market positioning
- Monetisation
- Launch planning
- Risk analysis
- Growth strategy


6 — Forge
Role:
Game Developer

Specialities:
- Godot Engine
- Godot 4
- GDScript
- Game development
- Gameplay systems
- Level design
- Horror games
- Game mechanics


MISSION:

Title:
${missionTitle}

Description:
${missionDescription || "No additional mission description was provided."}


YOUR JOB:

Analyse the mission as the CEO.

Determine which specialists are actually required.

Break the mission into clear professional tasks.

Delegate each task to the most appropriate AI agent.

Do NOT assign every agent unless the mission genuinely requires every agent.

You may assign multiple tasks to the same agent when necessary.

Valid may assign a planning or coordination task to itself when the mission requires management work.

Tasks must be specific enough that the assigned specialist can immediately perform useful work.

Avoid vague tasks such as:
- Help with project
- Work on app
- Research things
- Improve project

Prefer specific tasks such as:
- Design the mobile emergency-contact onboarding flow
- Implement Supabase authentication architecture
- Create launch positioning for Malaysian motorcycle riders
- Build a Godot 4 inventory interaction system

Return ONLY valid JSON.

Do not use markdown.

Do not place the JSON inside a code block.

Use exactly this structure:

{
  "analysis": "Short explanation of how the mission should be handled.",
  "tasks": [
    {
      "title": "Specific task title",
      "description": "Detailed instructions for the specialist.",
      "assignedAgent": 2
    }
  ]
}

RULES:

- assignedAgent must be a number from 1 to 6.
- Create only useful tasks.
- Prefer approximately 2 to 6 tasks for a normal mission.
- Do not create duplicate tasks.
- Do not invent additional agents.
- Match tasks to agent specialities.
- Keep task descriptions practical.
- Do not include commentary outside the JSON.
  `.trim();
}

/*
  RUNTIME VALIDATION

  Never blindly trust AI-generated JSON.
*/

function isValidOrchestrationResult(
  value: unknown,
): value is OrchestrationResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  if (typeof result.analysis !== "string") {
    return false;
  }

  if (!Array.isArray(result.tasks)) {
    return false;
  }

  return result.tasks.every((task) => {
    if (typeof task !== "object" || task === null) {
      return false;
    }

    const candidate = task as Record<string, unknown>;

    return (
      typeof candidate.title === "string" &&
      typeof candidate.description === "string" &&
      typeof candidate.assignedAgent === "number"
    );
  });
}
