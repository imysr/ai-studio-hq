import { NextResponse } from "next/server";
import { isApiOwnerAuthenticated } from "@/lib/auth/apiOwner";
import { checkAIServerRateLimit } from "@/lib/aiServerRateLimit";

/*
  VALID — AI ORCHESTRATOR

  This API allows Valid to analyse a mission,
  choose the correct AI specialists,
  decide task order,
  and create collaboration dependencies.

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

  /*
    These refer to indexes inside the
    generated task array.

    Example:
    dependsOnTaskIndexes: [0, 1]

    means this task must wait for
    task #0 and task #1.
  */

  dependsOnTaskIndexes?: number[];

  /*
    Results from these earlier tasks
    should later be passed into this
    agent as collaboration context.
  */

  contextFromTaskIndexes?: number[];
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
  Temporary failure
       ↓
  Wait 3 sec → Retry 1
       ↓
  Wait 8 sec → Retry 2
       ↓
  Wait 15 sec → Retry 3
       ↓
  Still failed?
       ↓
  Mission Control receives the error
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

    if (missionTitle.length > 200) {
      return NextResponse.json(
        {
          error: "Mission title must be 200 characters or fewer.",
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
      CALL VALID / GEMINI

      The helper performs:
      - initial request
      - automatic retries
      - retry delay protection
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
      SAFETY VALIDATION

      We sanitize:
      - agent IDs
      - titles
      - descriptions
      - dependency indexes
      - context indexes
    */

    const safeTasks = parsedResult.tasks
      .map((task, index) => {
        const dependsOnTaskIndexes = sanitizeTaskIndexes(
          task.dependsOnTaskIndexes,
          parsedResult.tasks.length,
          index,
        );

        const contextFromTaskIndexes = sanitizeTaskIndexes(
          task.contextFromTaskIndexes,
          parsedResult.tasks.length,
          index,
        );

        return {
          title: task.title.trim(),

          description: task.description.trim(),

          assignedAgent: task.assignedAgent,

          dependsOnTaskIndexes,

          contextFromTaskIndexes,
        };
      })
      .filter(
        (task) =>
          VALID_AGENT_IDS.includes(task.assignedAgent) &&
          task.title.length > 0 &&
          task.description.length > 0,
      );

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

  Initial call + automatic retries.
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

              maxOutputTokens: 2200,

              responseMimeType: "application/json",
            },
          }),
        },
      );

      /*
        READ AS TEXT FIRST

        Gemini normally returns JSON,
        but an upstream/server failure
        can occasionally return plain
        text such as:

        Internal Server Error

        Calling response.json() directly
        would expose an ugly JSON parser
        error to Mission Control.
      */

      const responseText = await response.text();

      let data: {
        error?: {
          message?: string;
        };

        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      } | null = null;

      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        /*
          Plain-text upstream failure.

          We deliberately do not expose
          the raw HTML/text response to
          Mission Control.
        */

        if (!response.ok) {
          throw new Error(
            `Gemini temporarily returned an invalid server response (HTTP ${response.status}).`,
          );
        }

        throw new Error("Gemini returned an unreadable response.");
      }

      /*
        GEMINI ERROR RESPONSE
      */

      if (!response.ok) {
        const message =
          data?.error?.message ??
          `Gemini request failed with HTTP ${response.status}.`;

        /*
          Permanent errors such as
          invalid API configuration
          should not waste retries.
        */

        if (!RETRYABLE_STATUS_CODES.includes(response.status)) {
          throw new PermanentOrchestrationError(message);
        }

        throw new Error(message);
      }

      /*
        EXTRACT VALID'S RESULT
      */

      const rawResult =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";

      if (!rawResult) {
        throw new Error("Valid returned an empty orchestration result.");
      }

      if (attempt > 0) {
        console.log(`Valid orchestration succeeded on attempt ${attempt + 1}.`);
      }

      return rawResult;
    } catch (error) {
      /*
        PERMANENT ERRORS

        Do not retry API-key/configuration
        problems.
      */

      if (error instanceof PermanentOrchestrationError) {
        throw error;
      }

      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown Valid orchestration error.");

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

  /*
    All automatic retries failed.

    Give Mission Control a clean,
    human-readable error instead of
    leaking JSON parser errors.
  */

  throw new Error(
    lastError?.message
      ? `Valid could not complete orchestration: ${lastError.message}`
      : "Valid could not complete orchestration. Please try again later.",
  );
}

/*
  PERMANENT ERROR

  Used for non-retryable problems.
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
- Documentation


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

Determine which specialists are genuinely required.

Break the mission into clear professional tasks.

Delegate each task to the most appropriate AI agent.

IMPORTANT:

You must also decide whether tasks depend on previous tasks.

Some agents may need another agent's completed work before they can begin.

Example:

Task 0:
Atlas creates product strategy.

Task 1:
Pixel creates the visual design using Atlas's strategy.

Task 2:
CodeBot builds the implementation using both Atlas's strategy and Pixel's design.

Task 2 would therefore contain:

"dependsOnTaskIndexes": [0, 1]

and:

"contextFromTaskIndexes": [0, 1]


TASK DEPENDENCY RULES:

- A task with no dependencies should use an empty array.
- A task may depend only on earlier tasks.
- Never depend on itself.
- Never depend on a later task.
- Use dependencies only when they are genuinely useful.
- Do not create artificial dependencies just to make the workflow longer.
- If two tasks can safely happen in parallel, they should not depend on each other.


COLLABORATION CONTEXT:

contextFromTaskIndexes controls which completed task results should be given to the assigned agent.

Use it when an agent needs to understand or build upon earlier work.

Examples:

Pixel may receive Atlas's strategy.

CodeBot may receive Pixel's design.

CodeBot may receive both Atlas's business requirements and Pixel's UI specification.

Forge may receive Pixel's game UI specification.

Sage may receive CodeBot's technical system explanation when preparing documentation.


GENERAL RULES:

- Do NOT assign every agent unless necessary.
- You may assign multiple tasks to one agent when justified.
- Valid may assign planning or coordination work to itself when required.
- Tasks must be specific and actionable.
- Avoid vague assignments.
- Avoid duplicate tasks.
- Match tasks to agent expertise.
- Prefer approximately 2 to 6 tasks for a normal mission.
- Think about execution order before creating dependencies.


Return ONLY valid JSON.

Do not use markdown.

Do not wrap the JSON in backticks.

Do not include commentary before or after the JSON.

Use exactly this structure:

{
  "analysis": "Short CEO analysis of how the mission should be executed.",
  "tasks": [
    {
      "title": "Specific task title",
      "description": "Detailed instructions for the assigned specialist.",
      "assignedAgent": 5,
      "dependsOnTaskIndexes": [],
      "contextFromTaskIndexes": []
    },
    {
      "title": "Specific dependent task",
      "description": "Detailed instructions that build upon earlier work.",
      "assignedAgent": 3,
      "dependsOnTaskIndexes": [0],
      "contextFromTaskIndexes": [0]
    }
  ]
}


FINAL RULES:

- assignedAgent must be a number from 1 to 6.
- dependsOnTaskIndexes must contain valid earlier task indexes only.
- contextFromTaskIndexes must contain valid earlier task indexes only.
- Never reference indexes that do not exist.
- Never create circular dependencies.
- Do not include commentary outside the JSON.
  `.trim();
}

/*
  SANITIZE TASK INDEXES

  AI-generated dependency indexes
  must never be trusted directly.

  Rules:
  - integer only
  - zero or greater
  - must exist
  - must point to an earlier task
  - must not duplicate
*/

function sanitizeTaskIndexes(
  value: number[] | undefined,
  taskCount: number,
  currentTaskIndex: number,
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const safeIndexes = value.filter(
    (index) =>
      Number.isInteger(index) &&
      index >= 0 &&
      index < taskCount &&
      index < currentTaskIndex,
  );

  return [...new Set(safeIndexes)];
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

    const validBasicFields =
      typeof candidate.title === "string" &&
      typeof candidate.description === "string" &&
      typeof candidate.assignedAgent === "number";

    if (!validBasicFields) {
      return false;
    }

    const validDependsOn =
      candidate.dependsOnTaskIndexes === undefined ||
      (Array.isArray(candidate.dependsOnTaskIndexes) &&
        candidate.dependsOnTaskIndexes.every(
          (item) => typeof item === "number",
        ));

    const validContext =
      candidate.contextFromTaskIndexes === undefined ||
      (Array.isArray(candidate.contextFromTaskIndexes) &&
        candidate.contextFromTaskIndexes.every(
          (item) => typeof item === "number",
        ));

    return validDependsOn && validContext;
  });
}
