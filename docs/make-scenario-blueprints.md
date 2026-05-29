# Make.com Scenario Blueprints

> This document outlines how AURA generates and exports reusable Make.com scenario templates to facilitate rapid, secure webhook integration.

## Overview

AURA integrates with Make.com to orchestrate cross-platform workflows (e.g., Slack notifications, Notion document updates, Jira ticketing) without directly bundling hundreds of API integrations into the local desktop app. This is achieved via Webhooks.

To make setup seamless for the user, AURA generates **Blueprints**. A Blueprint is a JSON definition of a Make.com scenario.

## Architecture

The `MakeBlueprintService` is responsible for generating these blueprints dynamically.

### AURA Core Event Router Blueprint

The default exported blueprint contains:
1. **Custom Webhook Module**: A trigger module that provides the endpoint URL AURA will call.
2. **Basic Router**: A Make.com router module that splits execution paths based on the `eventType` payload from AURA.

### Import Process

1. User clicks **Download Blueprint** in the AURA Settings (Connectors) panel.
2. AURA generates `aura-make-blueprint.json` and triggers a download.
3. User creates a new scenario in Make.com.
4. User clicks "More" -> "Import Blueprint" and uploads the JSON file.
5. User copies the newly generated webhook URL and pastes it back into AURA.

## Security Constraints

In Phase 2, AURA will only execute `dryRun` tests against the Make.com webhooks. No real autonomous payloads will be fired until the execution phase is fully authorized. The blueprints generated do not contain any secrets; they only contain the scenario structure.
