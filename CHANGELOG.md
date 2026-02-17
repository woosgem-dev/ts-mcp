# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-02-17

### Added
- MCP server with stdio transport for AI agent integration
- TypeScript Language Service wrapper with tsconfig auto-detection
- Navigation tools: `goto_definition`, `find_references`, `workspace_symbols`, `document_symbols`
- Impact analysis tools: `call_hierarchy`, `type_hierarchy`, `impact_analysis`
- Intelligence tools: `get_type_info`, `signature_help`, `rename_symbol`
- Diagnostics tool for project-wide or single-file TypeScript error reporting
- SymbolIndexer for fast workspace symbol search with disk cache and `--no-cache` flag
- JSDoc/TSDoc parser with custom tag support
- `readOnlyHint` annotations on all tools for MCP client auto-approve
- Error handling with `isError: true` responses on all tool handlers
- GitHub Actions CI workflow for test and build

### Fixed
- Workspace path resolution to absolute paths in Language Service constructor
- Position bounds checking in `resolvePosition` and `toOffset` to prevent out-of-range errors
