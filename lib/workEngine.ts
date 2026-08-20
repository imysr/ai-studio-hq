import { getTasks, saveTasks } from "@/lib/taskStorage";
import { saveActivity } from "@/lib/activityMemory";
import { getAgentMemory, saveAgentMemory } from "@/lib/agentMemory";
import { agents } from "@/data/agents";
import type { MissionTask } from "@/data/tasks";

/*
  REAL AI AGENTS

  CodeBot = 2
  Forge   = 6

  Other agents still use local template results.
*/

const REAL_AI_AGENTS = [2, 6];

const workLocations: Record<number, string> = {
  1: "CEO Office",
  2: "Development Lab",
  3: "Design Studio",
  4: "Learning Academy",
  5: "Strategy Room",
  6: "Game Studio",
};

export function startAgentTask(taskId: number) {
  const tasks = getTasks();

  const updatedTasks: MissionTask[] = tasks.map((task): MissionTask => {
    if (task.id !== taskId) {
      return task;
    }

    const agent = agents.find((a) => a.id === task.assignedAgent);

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

  CodeBot and Forge use Gemini.

  Valid, Pixel, Sage and Atlas
  still use template results.
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
    TEMPLATE AGENT
  */

  const result = generateTaskResult(task);

  finalizeTask(task, result);
}

/*
  MANUAL AI RETRY

  This is intentionally NOT called
  by the scheduler.

  It is only used when the user presses
  the Retry AI button manually.
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

  /*
    Only CodeBot and Forge currently
    have real Gemini access.
  */

  if (!REAL_AI_AGENTS.includes(task.assignedAgent)) {
    return {
      success: false,
      message: "This agent does not have real AI access yet.",
    };
  }

  /*
    Retry is ONLY allowed for a task
    that failed while generating at 75%.

    This protects us from accidental
    extra Gemini requests.
  */

  if (task.status !== "Working" || task.progress !== 75) {
    return {
      success: false,
      message: "This task is not waiting for an AI retry.",
    };
  }

  const agent = agents.find((a) => a.id === task.assignedAgent);

  if (!agent) {
    return {
      success: false,
      message: "Agent not found.",
    };
  }

  /*
    Temporarily move back to 50%.

    completeRealAITask() only accepts
    Working tasks at 50%.

    It will immediately move the task
    back to 75% while Gemini generates.
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
    Check whether the retry succeeded.
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
  REAL GEMINI TASK

  Used by:
  - CodeBot
  - Forge
*/

async function completeRealAITask(task: MissionTask) {
  /*
    Only Working 50% tasks are allowed
    to start an API request.

    Once Gemini generation begins,
    progress becomes 75%.

    This protects us from repeated
    requests caused by the scheduler.
  */

  if (task.status !== "Working" || task.progress !== 50) {
    return;
  }

  const agent = agents.find((a) => a.id === task.assignedAgent);

  if (!agent) {
    return;
  }

  /*
    Only explicitly enabled AI agents
    may reach Gemini.
  */

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
      CALL OUR NEXT.JS API

      Browser:
      /api/ai

      Server:
      Gemini

      The API key stays securely inside
      .env.local.
    */

    const response = await fetch("/api/ai", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        agent: agent.name,

        taskTitle: task.title,

        instructions: task.description,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error ?? `${agent.name} AI request failed.`);
    }

    const result = typeof data.result === "string" ? data.result.trim() : "";

    if (!result) {
      throw new Error(`${agent.name} returned an empty AI result.`);
    }

    /*
      SAVE REAL GEMINI RESULT
    */

    finalizeTask(task, result);
  } catch (error) {
    console.error(`${agent.name} AI error:`, error);

    /*
      IMPORTANT

      No automatic retry.

      Task stays:
      Working
      75%

      The user must manually press
      Retry AI.
    */

    saveActivity({
      id: Date.now(),

      time: new Date().toLocaleTimeString(),

      icon: "⚠️",

      message: `${agent.name} AI generation failed for ${task.title}`,
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

  const agent = agents.find((a) => a.id === task.assignedAgent);

  saveActivity({
    id: Date.now(),

    time: new Date().toLocaleTimeString(),

    icon: "✅",

    message: `${agent?.name ?? "AI Agent"} completed ${task.title}`,
  });

  updateAgentMemory(task, "Completed");
}

/*
  TEMPORARY LOCAL RESULT GENERATOR

  Still template-based:
  - Valid
  - Pixel
  - Sage
  - Atlas

  Real Gemini:
  - CodeBot
  - Forge
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
      CODEBOT FALLBACK
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
      FORGE FALLBACK
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
  NORMAL AGENT MEMORY
*/

function updateAgentMemory(task: MissionTask, status: string) {
  const memory = getAgentMemory();

  const updated = memory.map((agent) => {
    if (agent.id !== task.assignedAgent) {
      return agent;
    }

    return {
      ...agent,

      currentTask:
        status === "Completed" ? "Waiting for assignment" : task.title,

      missionStatus: status === "Completed" ? "Idle" : "Working",

      location:
        status === "Completed"
          ? "Office"
          : (workLocations[task.assignedAgent] ?? "Office"),

      energy: status === "Completed" ? 100 : 90,

      lastAction:
        status === "Completed"
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

      energy: 85,

      lastAction: `Generating AI work for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}

/*
  AI RETRY MEMORY
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

      energy: 85,

      lastAction: `Retrying AI generation for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}

/*
  REAL AI ERROR MEMORY

  No automatic retry is performed.
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

      energy: 85,

      lastAction: `AI generation failed for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}
