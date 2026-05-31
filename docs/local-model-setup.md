# Local Model Setup Guide

To enable AURA's local model routing and ensure data privacy + zero cost for trivial operations, you need to install Ollama locally.

## 1. Install Ollama
Download and install Ollama from [ollama.com](https://ollama.com/).

## 2. Verify Installation
Ensure the Ollama API is running on `localhost:11434`. AURA checks this endpoint automatically.
Run `ollama serve` if it isn't running.

## 3. Pull Recommended Models
AURA will detect your system specs (CPU, RAM, GPU) and recommend models automatically via the `CheapFirstRouterService`.
To prepare your system, pull the following models:

- **Minimal Setup** (8GB+ RAM):
  `ollama run phi3:mini`
- **Standard Setup** (16GB+ RAM):
  `ollama run llama3:8b`
- **High-End Setup** (32GB+ RAM + GPU):
  `ollama run mixtral:8x7b`

## 4. How Routing Works
When AURA receives a task, it categorizes it by complexity.
1. **Recipes**: If a task has been learned via the `RecipeLearningService`, AURA skips model inference and directly replays the exact tool sequence.
2. **Local Models**: If the task is `trivial` or `simple` (e.g. format this string, tell me the date, rename a variable), AURA queries the Ollama model.
3. **Cheap Cloud**: If local is unavailable, AURA falls back to `gpt-4o-mini` or `claude-3-haiku`.
4. **Smart Cloud**: For complex operations, AURA routes directly to `gpt-4o` or `claude-3-5-sonnet`.
