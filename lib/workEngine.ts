import { getTasks, saveTasks } from "@/lib/taskStorage";
import { saveActivity } from "@/lib/activityMemory";
import { getAgentMemory, saveAgentMemory } from "@/lib/agentMemory";
import { agents } from "@/data/agents";
import type { MissionTask } from "@/data/tasks";

import {
  markAIRequestStarted,
  markAIRequestCompleted,
  markAIRequestRateLimited,
  markAIRequestWaiting,
  markQueuedRequestStarted,
  markAIRequestFailed,
} from "@/lib/aiRequestManager";

/*
  REAL AI AGENTS

  1 = Valid
  2 = CodeBot
  3 = Pixel
  4 = Sage
  5 = Atlas
  6 = Forge
*/

const REAL_AI_AGENTS = [1, 2, 3, 4, 5, 6];

const workLocations: Record<number, string> = {
  1: "CEO Office",
  2: "Development Lab",
  3: "Design Studio",
  4: "Learning Academy",
  5: "Strategy Room",
  6: "Game Studio",
};

/*
  AUTOMATIC AI RETRY

  Initial request
      ↓
  Failure
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
  Still failed?
      ↓
  Pause at 75%
      ↓
  Manual Retry AI button
*/

const AUTO_RETRY_DELAYS = [3000, 8000, 15000];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/*
  START AGENT TASK
*/

export function startAgentTask(taskId: number) {
  const tasks = getTasks();

  const updatedTasks: MissionTask[] = tasks.map((task): MissionTask => {
    if (task.id !== taskId) {
      return task;
    }

    const agent = agents.find((item) => item.id === task.assignedAgent);

    saveActivity({
      id: Date.now(),

      time: new Date().toLocaleTimeString(),

      icon: agent?.emoji ?? "⚙️",

      message: `${agent?.name ?? "AI Agent"} started ${task.title}`,
    });

    updateAgentMemory(task, "Working");

    return {
      ...task,

      status: "Working",

      progress: 50,
    };
  });

  saveTasks(updatedTasks);
}

/*
  COMPLETE TASK

  All six agents currently use Gemini.

  The local template generator remains
  only as a fallback architecture.
*/

export async function completeAgentTask(taskId: number) {
  const tasks = getTasks();

  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  /*
    REAL AI AGENT
  */

  if (REAL_AI_AGENTS.includes(task.assignedAgent)) {
    await completeRealAITask(task);

    return;
  }

  /*
    FALLBACK TEMPLATE AGENT
  */

  const result = generateTaskResult(task);

  finalizeTask(task, result);
}

/*
  MANUAL AI RETRY

  This remains available as the final
  fallback after all automatic retries fail.
*/

export async function retryAgentTask(taskId: number) {
  const tasks = getTasks();

  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return {
      success: false,
      message: "Task not found.",
    };
  }

  if (!REAL_AI_AGENTS.includes(task.assignedAgent)) {
    return {
      success: false,
      message: "This agent does not have real AI access yet.",
    };
  }

  /*
    Retry is ONLY allowed when
    the task has stopped at 75%.

    This protects us from accidental
    duplicate API requests.
  */

  if (task.status !== "Working" || task.progress !== 75) {
    return {
      success: false,
      message: "This task is not waiting for an AI retry.",
    };
  }

  const agent = agents.find((item) => item.id === task.assignedAgent);

  if (!agent) {
    return {
      success: false,
      message: "Agent not found.",
    };
  }

  /*
    Move temporarily back to 50%.

    completeRealAITask() only starts
    requests for Working / 50% tasks.
  */

  const resetTasks: MissionTask[] = tasks.map((item): MissionTask => {
    if (item.id !== task.id) {
      return item;
    }

    return {
      ...item,

      status: "Working",

      progress: 50,
    };
  });

  saveTasks(resetTasks);

  saveActivity({
    id: Date.now(),

    time: new Date().toLocaleTimeString(),

    icon: "🔄",

    message: `Retrying AI generation for ${agent.name}: ${task.title}`,
  });

  updateAgentRetryMemory(task);

  const retryTask: MissionTask = {
    ...task,

    status: "Working",

    progress: 50,
  };

  await completeRealAITask(retryTask);

  /*
    Check whether manual retry succeeded.
  */

  const refreshedTasks = getTasks();

  const refreshedTask = refreshedTasks.find((item) => item.id === task.id);

  if (refreshedTask?.status === "Completed" && refreshedTask.progress === 100) {
    return {
      success: true,

      message: `${agent.name} completed the task successfully.`,
    };
  }

  return {
    success: false,

    message: `${agent.name} could not complete the AI request. You can retry later.`,
  };
}

/*
  BUILD COLLABORATION CONTEXT

  If Valid instructed this task to use
  results from previous tasks, collect
  those completed results and include
  them in the next agent's instructions.
*/

const MAX_AI_INSTRUCTIONS_LENGTH = 9_500;
const MAX_CONTEXT_RESULT_LENGTH = 3_500;

function trimTextToLength(text: string, maxLength: number) {
  const cleanText = text.trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength)}\n\n[Context trimmed to fit AI request limits.]`;
}

function buildCollaborationInstructions(task: MissionTask): string {
  const contextTaskIds = task.contextFromTasks ?? [];

  /*
    Keep the primary task description first.

    /api/ai currently accepts a maximum of
    10,000 instruction characters, so this
    builder intentionally stays below that
    server-side limit.

    Long collaborator results are trimmed
    instead of causing the entire retry or
    mission task to fail validation.
  */

  const primaryTask = trimTextToLength(task.description, 4_000);

  if (contextTaskIds.length === 0) {
    return primaryTask;
  }

  const allTasks = getTasks();

  const contextTasks = contextTaskIds
    .map((taskId) => allTasks.find((item) => item.id === taskId))
    .filter((item): item is MissionTask =>
      Boolean(item && item.status === "Completed" && item.result?.trim()),
    );

  if (contextTasks.length === 0) {
    return primaryTask;
  }

  const collaborationContext = contextTasks
    .map((contextTask, index) => {
      const contextAgent = agents.find(
        (agent) => agent.id === contextTask.assignedAgent,
      );

      const trimmedResult = trimTextToLength(
        contextTask.result ?? "",
        MAX_CONTEXT_RESULT_LENGTH,
      );

      return `
COLLABORATOR ${index + 1}

Agent:
${contextAgent?.name ?? "AI Agent"}

Previous Task:
${contextTask.title}

Completed Result:
${trimmedResult}
      `.trim();
    })
    .join("\n\n------------------------------\n\n");

  const instructions = `
PRIMARY TASK

${primaryTask}


COLLABORATION CONTEXT

The following work was completed by other AI agents earlier in this mission.

Use this information when it is relevant to your assignment.

Do not simply repeat their work.

Build upon it, improve it, or use it as input for your own specialist task.

${collaborationContext}


YOUR RESPONSIBILITY

Complete your own assigned task using the collaboration context above where useful.

Your response should remain focused on your own specialist responsibility.
  `.trim();

  return trimTextToLength(instructions, MAX_AI_INSTRUCTIONS_LENGTH);
}

/*
  AI REQUEST ERROR HELPERS

  These allow the shared request manager
  to understand Gemini quota errors.
*/

function getRetryAfterSeconds(errorMessage: string): number {
  const match = errorMessage.match(/retry\s+in\s+([\d.]+)\s*s/i);

  if (!match) {
    return 10;
  }

  const seconds = Number.parseFloat(match[1]);

  if (!Number.isFinite(seconds)) {
    return 10;
  }

  /*
    Small buffer prevents us from
    retrying at the exact reset moment.
  */

  return Math.max(2, Math.ceil(seconds) + 2);
}

function isRateLimitError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();

  return (
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("429")
  );
}

/*
  REQUEST AI RESULT

  Handles:
  - shared AI request manager
  - automatic retries
  - quota-aware waiting
  - queue tracking

  IMPORTANT:
  This does NOT reset task progress.

  The task remains at 75% while
  Gemini is generating or retrying.
*/

async function requestAIResult(
  agentName: string,
  task: MissionTask,
): Promise<string> {
  let lastError: Error | null = null;

  const totalAttempts = AUTO_RETRY_DELAYS.length + 1;

  /*
    Tracks whether the request was
    actually moved into the queue.

    Normal temporary failures remain
    active and therefore must NOT call
    markQueuedRequestStarted().
  */

  let queuedForRetry = false;

  /*
    Initial Gemini request.
  */

  markAIRequestStarted();

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      /*
        If the previous failure was
        rate-limited, move the queued
        request back into Processing.
      */

      if (queuedForRetry) {
        markQueuedRequestStarted();

        queuedForRetry = false;
      }

      const response = await fetch("/api/ai", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          agent: agentName,

          taskTitle: task.title,

          instructions: buildCollaborationInstructions(task),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? `${agentName} AI request failed.`);
      }

      const result = typeof data.result === "string" ? data.result.trim() : "";

      if (!result) {
        throw new Error(`${agentName} returned an empty AI result.`);
      }

      /*
        SUCCESS
      */

      markAIRequestCompleted();

      return result;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Unknown AI request error.");

      const errorMessage = lastError.message;

      const rateLimited = isRateLimitError(errorMessage);

      /*
        FINAL FAILURE

        No more retries remain.
      */

      if (attempt >= AUTO_RETRY_DELAYS.length) {
        markAIRequestFailed(errorMessage);

        break;
      }

      const retryNumber = attempt + 1;

      /*
        Normal temporary failures use
        our existing retry delays.

        Rate-limit failures use
        Gemini's suggested retry time.
      */

      let delay = AUTO_RETRY_DELAYS[attempt];

      if (rateLimited) {
        const retrySeconds = getRetryAfterSeconds(errorMessage);

        delay = retrySeconds * 1000;

        /*
          Rate-limited request leaves
          active processing and enters
          the queue.
        */

        markAIRequestRateLimited(retrySeconds, errorMessage);

        queuedForRetry = true;
      } else {
        /*
          Normal retry remains an active
          request, but the state tells
          the HQ that the request is
          temporarily waiting.
        */

        markAIRequestWaiting();
      }

      console.warn(
        `${agentName} AI attempt failed. Automatic retry ${retryNumber}/${AUTO_RETRY_DELAYS.length} in ${delay}ms.`,
        lastError,
      );

      saveActivity({
        id: Date.now(),

        time: new Date().toLocaleTimeString(),

        icon: rateLimited ? "⏳" : "🔄",

        message: rateLimited
          ? `${agentName} is waiting for Gemini capacity before retrying ${task.title}`
          : `${agentName} automatic AI retry ${retryNumber}/${AUTO_RETRY_DELAYS.length} for ${task.title}`,
      });

      updateAgentRetryMemory(task);

      await wait(delay);
    }
  }

  throw lastError ?? new Error(`${agentName} AI request failed.`);
}

/*
  REAL GEMINI TASK

  Used by all six AI agents.
*/

async function completeRealAITask(task: MissionTask) {
  /*
    Only Working / 50% tasks may
    start a new AI generation cycle.

    Once generation begins,
    progress becomes 75%.

    This protects the API from
    duplicate scheduler requests.
  */

  if (task.status !== "Working" || task.progress !== 50) {
    return;
  }

  const agent = agents.find((item) => item.id === task.assignedAgent);

  if (!agent) {
    return;
  }

  if (!REAL_AI_AGENTS.includes(task.assignedAgent)) {
    return;
  }

  /*
    MARK TASK AS GENERATING
  */

  const currentTasks = getTasks();

  const generatingTasks: MissionTask[] = currentTasks.map(
    (item): MissionTask => {
      if (item.id !== task.id) {
        return item;
      }

      return {
        ...item,

        progress: 75,
      };
    },
  );

  saveTasks(generatingTasks);

  updateAgentGeneratingMemory(task);

  saveActivity({
    id: Date.now(),

    time: new Date().toLocaleTimeString(),

    icon: "🧠",

    message: `${agent.name} is generating real AI work for ${task.title}`,
  });

  try {
    /*
      This function performs:
      - Initial Gemini request
      - Shared request-manager tracking
      - Automatic retries
      - Quota-aware waiting
    */

    const result = await requestAIResult(agent.name, task);

    /*
      SAVE REAL GEMINI RESULT
    */

    finalizeTask(task, result);
  } catch (error) {
    console.error(`${agent.name} AI error:`, error);

    /*
      All automatic retries failed.

      The task intentionally remains:

      Working
      75%

      This allows the user to use
      the manual Retry AI button.
    */

    saveActivity({
      id: Date.now(),

      time: new Date().toLocaleTimeString(),

      icon: "⚠️",

      message: `${agent.name} AI generation failed after automatic retries for ${task.title}`,
    });

    updateAgentErrorMemory(task);
  }
}

/*
  FINALIZE COMPLETED TASK
*/

function finalizeTask(task: MissionTask, result: string) {
  const tasks = getTasks();

  const updatedTasks: MissionTask[] = tasks.map((item): MissionTask => {
    if (item.id !== task.id) {
      return item;
    }

    return {
      ...item,

      status: "Completed",

      progress: 100,

      result,
    };
  });

  saveTasks(updatedTasks);

  const agent = agents.find((item) => item.id === task.assignedAgent);

  saveActivity({
    id: Date.now(),

    time: new Date().toLocaleTimeString(),

    icon: "✅",

    message: `${agent?.name ?? "AI Agent"} completed ${task.title}`,
  });

  updateAgentMemory(task, "Completed");
}

/*
  LOCAL FALLBACK RESULT GENERATOR

  Normally this should not run because
  all six agents currently have Gemini.

  We keep it as a defensive fallback.
*/

function generateTaskResult(task: MissionTask): string {
  switch (task.assignedAgent) {
    /*
      VALID
    */

    case 1:
      return `
VALID — CEO ANALYSIS

Task:
${task.title}

Instructions:
${task.description}

Analysis:
The assignment has been reviewed from a management and strategic perspective.

Recommended Action:
1. Define the primary objective.
2. Identify the required AI departments.
3. Break the objective into smaller tasks.
4. Assign responsibilities.
5. Review progress and outcomes.

Status:
Strategic analysis completed.
      `.trim();

    /*
      CODEBOT
    */

    case 2:
      return `
CODEBOT — DEVELOPMENT REPORT

Task:
${task.title}

Instructions:
${task.description}

Status:
CodeBot completed the development task.
      `.trim();

    /*
      PIXEL
    */

    case 3:
      return `
PIXEL — DESIGN REPORT

Task:
${task.title}

Instructions:
${task.description}

Design Direction:
1. Establish the visual hierarchy.
2. Define layout and spacing.
3. Create a consistent interface style.
4. Improve usability and accessibility.
5. Prepare the design for implementation.

Status:
Initial design concept completed.
      `.trim();

    /*
      SAGE
    */

    case 4:
      return `
SAGE — LEARNING REPORT

Task:
${task.title}

Instructions:
${task.description}

Learning Plan:
1. Define the learning objective.
2. Organise the subject into clear sections.
3. Explain the key concepts.
4. Add practical learning activities.
5. Review understanding and outcomes.

Status:
Learning structure completed.
      `.trim();

    /*
      ATLAS
    */

    case 5:
      return `
ATLAS — STRATEGY REPORT

Task:
${task.title}

Instructions:
${task.description}

Business Analysis:
1. Identify the main opportunity.
2. Review potential users or customers.
3. Consider risks and limitations.
4. Define possible strategies.
5. Recommend the next business action.

Status:
Initial strategy analysis completed.
      `.trim();

    /*
      FORGE
    */

    case 6:
      return `
FORGE — GAME DEVELOPMENT REPORT

Task:
${task.title}

Instructions:
${task.description}

Status:
Forge completed the game-development task.
      `.trim();

    default:
      return `
AI WORK RESULT

Task:
${task.title}

Instructions:
${task.description}

Status:
Task completed successfully.
      `.trim();
  }
}

/*
  ENERGY HELPERS

  Energy is now persistent simulation state.

  A normal AI task uses energy in stages:
  - task start:      -5
  - AI generation: -10
  - completion:      -5

  Retries use a small additional amount.

  Energy is restored by the Virtual HQ
  Lounge rather than being reset to 100
  when a task finishes.
*/

function clampEnergy(value: number) {
  return Math.max(0, Math.min(100, value));
}

function spendEnergy(currentEnergy: number, amount: number) {
  return clampEnergy(currentEnergy - amount);
}

/*
  NORMAL AGENT MEMORY
*/

function updateAgentMemory(task: MissionTask, status: string) {
  const memory = getAgentMemory();

  const updated = memory.map((agent) => {
    if (agent.id !== task.assignedAgent) {
      return agent;
    }

    const completed = status === "Completed";

    return {
      ...agent,

      currentTask: completed ? "Waiting for assignment" : task.title,

      missionStatus: completed ? "Idle" : "Working",

      location: completed
        ? "Office"
        : (workLocations[task.assignedAgent] ?? "Office"),

      energy: spendEnergy(agent.energy, 5),

      lastAction: completed
        ? `Completed ${task.title}`
        : `Started ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}

/*
  REAL AI GENERATING MEMORY
*/

function updateAgentGeneratingMemory(task: MissionTask) {
  const memory = getAgentMemory();

  const updated = memory.map((agent) => {
    if (agent.id !== task.assignedAgent) {
      return agent;
    }

    return {
      ...agent,

      currentTask: task.title,

      missionStatus: "Generating AI Result",

      location: workLocations[task.assignedAgent] ?? "Office",

      energy: spendEnergy(agent.energy, 10),

      lastAction: `Generating AI work for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}

/*
  AI RETRY MEMORY

  Used for:
  - automatic retries
  - manual retries
*/

function updateAgentRetryMemory(task: MissionTask) {
  const memory = getAgentMemory();

  const updated = memory.map((agent) => {
    if (agent.id !== task.assignedAgent) {
      return agent;
    }

    return {
      ...agent,

      currentTask: task.title,

      missionStatus: "Retrying AI",

      location: workLocations[task.assignedAgent] ?? "Office",

      energy: spendEnergy(agent.energy, 2),

      lastAction: `Retrying AI generation for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}

/*
  REAL AI ERROR MEMORY

  This state is reached only after
  all automatic retries have failed.

  Failed agents stay in their work room.
  They are NOT treated as idle employees,
  so the Lounge system will not move them.
*/

function updateAgentErrorMemory(task: MissionTask) {
  const memory = getAgentMemory();

  const updated = memory.map((agent) => {
    if (agent.id !== task.assignedAgent) {
      return agent;
    }

    return {
      ...agent,

      currentTask: task.title,

      missionStatus: "AI Generation Error",

      location: workLocations[task.assignedAgent] ?? "Office",

      energy: spendEnergy(agent.energy, 2),

      lastAction: `AI generation failed for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}
