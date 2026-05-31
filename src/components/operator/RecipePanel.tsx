import { useState, useEffect } from 'react';
import { BookOpen, Play, Trash2, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { Recipe } from '../../types/recipe';
import { recipeLearningService } from '../../services/recipes/RecipeLearningService';
import { cn } from '../../lib/utils';

export function RecipePanel() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    return recipeLearningService.subscribe(setRecipes);
  }, []);

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-zinc-500 space-y-3">
        <BookOpen className="w-8 h-8 opacity-20" />
        <p className="text-[11px] text-center">No recipes learned yet.<br/>AURA will suggest recipes as you repeat tasks.</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      {recipes.map(recipe => (
        <div key={recipe.id} className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3 flex flex-col gap-2">
          
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-[12px] font-semibold text-zinc-200 truncate">{recipe.name}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{recipe.description}</p>
            </div>
            {recipe.safetyLevel === 'needs_approval' && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-widest">
                <ShieldAlert className="w-2.5 h-2.5" /> Approval
              </span>
            )}
          </div>

          {/* Body: Steps Preview */}
          <div className="bg-zinc-950/50 rounded-lg p-2 border border-zinc-800/40">
            <div className="text-[9px] font-semibold text-zinc-600 uppercase mb-1.5 tracking-wider">Learned Steps</div>
            <div className="space-y-1.5">
              {recipe.steps.map(step => (
                <div key={step.id} className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[8px] shrink-0 mt-0.5">{step.order}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-zinc-300 font-mono truncate">{step.toolUsed}</div>
                    {Object.keys(step.parameters).length > 0 && (
                      <div className="text-[9px] text-zinc-600 truncate mt-0.5">
                        {JSON.stringify(step.parameters)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer: Stats & Actions */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {recipe.successCount}</span>
              <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-rose-500" /> {recipe.failureCount}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => recipeLearningService.deleteRecipe(recipe.id)}
                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                title="Forget Recipe"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => recipeLearningService.replayRecipe(recipe.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-semibold rounded-lg border border-indigo-500/20 transition-all"
              >
                <Play className="w-3 h-3" /> Replay
              </button>
            </div>
          </div>

        </div>
      ))}
    </div>
  );
}
