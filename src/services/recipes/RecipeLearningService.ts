import { Recipe, RecipeStep, SafetyLevel } from '../../types/recipe';
import { runtimeTaskService, type RuntimeTaskEvent } from '../runtime/RuntimeTaskService';
import { notificationService } from '../notifications/NotificationService';
import type { RuntimeTask } from '../../types/runtime-task';

export type RecipeListener = (recipes: Recipe[]) => void;

class RecipeLearningServiceImpl {
  private recipes: Map<string, Recipe> = new Map();
  private listeners: Set<RecipeListener> = new Set();
  private readonly STORAGE_KEY = 'aura.recipes';
  private patternBuffer: RuntimeTask[] = [];

  constructor() {
    this.loadRecipes();
  }

  start() {
    runtimeTaskService.subscribe(this.handleTaskEvent.bind(this));
  }

  subscribe(listener: RecipeListener): () => void {
    this.listeners.add(listener);
    // immediately notify the new listener
    listener(this.getAllRecipes());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const all = this.getAllRecipes();
    this.listeners.forEach(l => l(all));
  }

  private loadRecipes() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed: Recipe[] = JSON.parse(raw);
        parsed.forEach(r => this.recipes.set(r.id, r));
      }
    } catch (err) {
      console.error('Failed to load recipes from localStorage', err);
    }
  }

  private saveRecipes() {
    try {
      const all = Array.from(this.recipes.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      console.error('Failed to save recipes to localStorage', err);
    }
  }

  getAllRecipes(): Recipe[] {
    return Array.from(this.recipes.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  deleteRecipe(id: string) {
    if (this.recipes.delete(id)) {
      this.saveRecipes();
      this.notify();
    }
  }

  private handleTaskEvent(event: RuntimeTaskEvent) {
    if (event.type === 'task_completed') {
      this.analyzePattern(event.task);
    }
  }

  private analyzePattern(task: RuntimeTask) {
    // Only track tasks that executed tools successfully
    if (!task.toolName) return;

    this.patternBuffer.push(task);
    if (this.patternBuffer.length > 20) {
      this.patternBuffer.shift();
    }

    // A very naive heuristic for Phase 3H:
    // If the same tool was used 3 times recently with similar intents, suggest a recipe.
    const similarTasks = this.patternBuffer.filter(t => t.toolName === task.toolName);
    if (similarTasks.length >= 3) {
      // Suggest recipe if not already exists for this tool
      const existing = Array.from(this.recipes.values()).find(r => 
        r.steps.some(s => s.toolUsed === task.toolName)
      );

      if (!existing) {
        this.suggestRecipe(similarTasks.slice(-3));
        // clear from buffer so we don't spam
        this.patternBuffer = this.patternBuffer.filter(t => t.toolName !== task.toolName);
      }
    }
  }

  private suggestRecipe(sourceTasks: RuntimeTask[]) {
    const toolName = sourceTasks[0].toolName!;
    const newRecipe: Recipe = {
      id: `recipe_${Date.now()}`,
      name: `Automated: ${toolName}`,
      description: `Discovered from repeated usage of ${toolName}`,
      triggerPhrase: `run ${toolName} workflow`,
      steps: [
        {
          id: `step_1`,
          order: 1,
          toolUsed: toolName,
          parameters: sourceTasks[0].args || {}
        }
      ],
      safetyLevel: 'needs_approval',
      approvalNeeded: true,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date().toISOString(),
      sourceTaskIds: sourceTasks.map(t => t.id)
    };

    this.recipes.set(newRecipe.id, newRecipe);
    this.saveRecipes();
    this.notify();

    notificationService.add({
      type: 'task_update',
      title: 'New Recipe Learned',
      message: `AURA noticed you repeatedly use ${toolName} and created a recipe.`,
      ttl: 6000
    });
  }

  // Replay a recipe by creating a series of RuntimeTasks (or passing back to Dispatch)
  async replayRecipe(id: string) {
    const recipe = this.recipes.get(id);
    if (!recipe) return;

    // Increment usage
    recipe.lastUsedAt = new Date().toISOString();
    this.saveRecipes();
    this.notify();

    notificationService.add({
      type: 'info',
      title: `Replaying Recipe`,
      message: `Running: ${recipe.name}`,
      ttl: 3000
    });

    // In a full implementation, this would dispatch the tools back into AuraToolDispatchService
    // For now, we simulate success
    setTimeout(() => {
      recipe.successCount++;
      this.saveRecipes();
      this.notify();
    }, 1000);
  }
}

export const recipeLearningService = new RecipeLearningServiceImpl();
// Start monitoring tasks
recipeLearningService.start();
