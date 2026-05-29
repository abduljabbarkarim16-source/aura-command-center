# AURA Provider Adapter Foundation

**Milestone:** G  
**Branch:** `provider-adapter-foundation`

## Purpose

Turn the provider registry into an adapter-ready architecture. Each provider now has a structured adapter definition, config validation, dry-run capability, and a request/response shape — without making any real API calls.

## Key Types (`src/services/providers/ProviderAdapterService.ts`)

| Type | Purpose |
|---|---|
| `ProviderSecretRef` | Env var name + presence flag (never value) |
| `ProviderRuntimeConfig` | Shape of config (model, headers, timeout, secretRef) |
| `ProviderRequest` | Sanitised request shape (prompt, model, capability) |
| `ProviderResponse` | Response shape (content, isDryRun, error) |
| `ProviderDryRunResult` | Validation result without execution |
| `ProviderConnectionTest` | Recorded test result (passed/failed/not_tested) |

## Dry-Run Process

```typescript
const result = providerAdapterService.dryRun('anthropic');
// {
//   isConfigured: false,          // Key not set
//   hasKey: false,
//   wouldSucceed: false,
//   blockers: ['API key not set. Add VITE_ANTHROPIC_API_KEY to .env'],
//   configShape: { model: 'claude-sonnet-4-6', timeout: 30000, ... }
// }
```

The dry-run:
1. Checks key presence (truthy env var check only)
2. Returns config shape showing what a real request would look like
3. Lists blockers and recommendations
4. Never makes HTTP requests
5. Never logs key values

## Request Placeholder

```typescript
const placeholder = providerAdapterService.createProviderRequestPlaceholder(
  'anthropic',
  'chat',
  'Summarise the current workspace scan',
);
// { providerId: 'provider-anthropic', capability: 'chat', prompt: '[PLACEHOLDER]...', model: 'claude-sonnet-4-6' }
```

## Security Boundaries

- `ProviderSecretRef.present` is a boolean — never stores the value
- `createProviderRequestPlaceholder` replaces the real prompt with a description
- `simulateDryRunResponse` never contacts any endpoint
- All key checks use `import.meta.env.VITE_*` truthiness only

## Real Adapter Execution (Phase 3)

When Phase 3 arrives, `providerAdapterService.execute(request)` will:
1. Read key from `import.meta.env.VITE_*` at call time (not stored)
2. Build the HTTP request body
3. Make the API call with proper headers
4. Return a `ProviderResponse`
5. Emit a runtime event (notification bridge)
