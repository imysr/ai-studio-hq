import { getTasks, saveTasks } from "@/lib/taskStorage";
import { saveActivity } from "@/lib/activityMemory";
import { getAgentMemory, saveAgentMemory } from "@/lib/agentMemory";
import { agents } from "@/data/agents";
import type { MissionTask } from "@/data/tasks";

export function startAgentTask(taskId: number) {
  const tasks = getTasks();

  const updatedTasks: MissionTask[] = tasks.map((task): MissionTask => {
    if (task.id === taskId) {
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
    }

    return task;
  });

  saveTasks(updatedTasks);
}

/*
  COMPLETE TASK

  Forge (Agent 6)
  ----------------
  Uses the real Gemini API.

  Other agents
  ----------------
  Still use template-generated results
  until we test Forge properly.
*/

export async function completeAgentTask(taskId: number) {
  const tasks = getTasks();

  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  /*
    FORGE — REAL AI
  */

  if (task.assignedAgent === 6) {
    await completeForgeTask(task);

    return;
  }

  /*
    OTHER AGENTS — TEMPLATE RESULTS
  */

  const result = generateTaskResult(task);

  finalizeTask(task, result);
}

/*
  FORGE REAL GEMINI WORK
*/

async function completeForgeTask(task: MissionTask) {
  /*
    Safety protection.

    Forge may ONLY call Gemini when the
    task is actually Working at 50%.

    Once the API request begins, progress
    becomes 75%.

    This prevents the 5-second scheduler
    from sending the same Gemini request
    again and again.
  */

  if (task.status !== "Working" || task.progress !== 50) {
    return;
  }

  /*
    MARK AS GENERATING
  */

  const currentTasks = getTasks();

  const generatingTasks = currentTasks.map((item) => {
    if (item.id !== task.id) {
      return item;
    }

    return {
      ...item,

      progress: 75,
    };
  });

  saveTasks(generatingTasks);

  updateAgentGeneratingMemory(task);

  saveActivity({
    id: Date.now(),

    time: new Date().toLocaleTimeString(),

    icon: "🧠",

    message: `Forge is generating real AI work for ${task.title}`,
  });

  try {
    /*
      CALL OUR SECURE NEXT.JS API

      API key stays inside .env.local.
      It is never sent directly from the
      browser to Gemini.
    */

    const response = await fetch("/api/ai", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        agent: "Forge",

        taskTitle: task.title,

        instructions: task.description,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error ?? "Forge AI request failed.");
    }

    const result = typeof data.result === "string" ? data.result.trim() : "";

    if (!result) {
      throw new Error("Forge returned an empty AI result.");
    }

    /*
      SAVE REAL AI RESULT
    */

    finalizeTask(task, result);
  } catch (error) {
    console.error("Forge AI error:", error);

    /*
      IMPORTANT:

      We leave the task at Working 75%
      instead of automatically retrying.

      This protects the free API quota
      from an accidental retry loop.
    */

    saveActivity({
      id: Date.now(),

      time: new Date().toLocaleTimeString(),

      icon: "⚠️",

      message: `Forge AI generation failed for ${task.title}`,
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
  TEMPORARY RESULT GENERATOR

  Valid, CodeBot, Pixel, Sage and Atlas
  still use these templates.

  Forge no longer uses its template
  during automatic AI completion.
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

Development Plan:
1. Review the requested feature.
2. Define the component architecture.
3. Prepare the required logic.
4. Test the implementation.
5. Review for errors and improvements.

Status:
Initial development analysis completed.
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

      Normally Forge will not reach this
      because it uses Gemini.
    */

    case 6:
      return `
FORGE — GAME DEVELOPMENT REPORT

Task:
${task.title}

Instructions:
${task.description}

Status:
Forge completed the task.
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

  const workLocations: Record<number, string> = {
    1: "CEO Office",

    2: "Development Lab",

    3: "Design Studio",

    4: "Learning Academy",

    5: "Strategy Room",

    6: "Game Studio",
  };

  const updated = memory.map((agent) => {
    if (agent.id === task.assignedAgent) {
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
    }

    return agent;
  });

  saveAgentMemory(updated);
}

/*
  FORGE GENERATING MEMORY
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

      location: "Game Studio",

      energy: 85,

      lastAction: `Generating AI work for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}

/*
  FORGE ERROR MEMORY

  We intentionally do NOT automatically
  retry Gemini because we want to protect
  the free API quota.
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

      location: "Game Studio",

      energy: 85,

      lastAction: `AI generation failed for ${task.title}`,
    };
  });

  saveAgentMemory(updated);
}
