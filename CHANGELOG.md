# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-02-17

### Added

**13 MCP tools** for TypeScript code navigation and analysis:

- Navigation: `goto_definition`, `goto_type_definition`, `find_references`, `workspace_symbols`, `document_symbols`
- Impact analysis: `call_hierarchy`, `type_hierarchy`, `impact_analysis`
- Intelligence: `get_type_info`, `signature_help`, `rename_symbol`, `list_members`
- Diagnostics: `diagnostics`

**Core infrastructure:**

- MCP server with stdio transport for AI agent integration
- TypeScript Language Service wrapper with tsconfig auto-detection
- SymbolIndexer for fast workspace symbol search with disk cache (`--no-cache` to bypass)
- JSDoc/TSDoc parser with custom tag support
- `readOnlyHint` annotations on all tools for MCP client auto-approve
- Error handling with `isError: true` responses on all tool handlers

**File watcher:**

- `--watch` flag for live content updates on disk changes
- Per-file debounce (100ms), `.ts`/`.tsx` filter, `node_modules` exclusion
- Automatic symbol index invalidation and lazy rebuild

**Multi-project support:**

- `--projects` flag for monorepo workspaces with multiple `tsconfig.json`
- Automatic tsconfig discovery (max depth 3)
- `ServiceProvider` pattern for routing file-specific queries to the correct Language Service
- Workspace-wide queries merge results across all projects

**CI/CD:**

- GitHub Actions workflow for test and build on push/PR to main

### Fixed

- Workspace path resolution to absolute paths in Language Service constructor
- Position bounds checking in `resolvePosition` and `toOffset` to prevent out-of-range errors
