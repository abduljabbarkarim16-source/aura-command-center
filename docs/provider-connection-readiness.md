# Provider Connection Readiness

> This document defines the Phase 2G capability of AURA to safely monitor and test provider connectivity without leaking secrets or executing live LLM calls.

## Overview

In the Foundation Phase, AURA requires a strict separation between configuration readiness and actual execution. Provider capabilities are tracked via `ProviderRegistryService` and tested via `ProviderAdapterService`.

### Security Rules (Immutable)

1. **No Live Execution**: Dry runs validate the *shape* of the request and the *presence* of the secret, but they do NOT send HTTP requests to the provider.
2. **Secret Masking**: The `ProviderRegistryService` never holds the actual string value of a secret. It uses references like `vault::anthropic` or `ENV::VITE_ANTHROPIC_API_KEY`.
3. **Presence Checks Only**: The `SecureKeyService` and fallback `.env` checks only report truthy booleans.

## Connection States

A provider in AURA transitions through these states before becoming fully active:

- `missing_secret`: Provider is known, but no secret is configured in the Vault or `.env`.
- `secret_configured`: Secret presence confirmed.
- `dry_run_ready`: `ProviderAdapterService.dryRun()` confirmed the configuration shape is valid.
- `live_test_required`: (Phase 3) A real API call must be made to confirm the secret is valid and the model is accessible.
- `disabled`: User explicitly turned off the provider.
- `error`: Network or authentication failure during live testing.
- `planned`: AURA knows about the capability but the underlying infrastructure is not yet built.

## Dry Run Validation

When a user clicks "Dry-run adapter" in the UI, AURA performs the following checks:
1. Validates the provider is registered.
2. Constructs a `ProviderRuntimeConfig` shape with headers, timeouts, and masked secrets.
3. Ensures all required fields are present.
4. Returns a `ProviderDryRunResult` with blockers and recommendations if any validation fails.

This ensures that once Phase 3 execution is wired up, the foundational plumbing is already rock solid.
