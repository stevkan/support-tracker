# Changelog

All notable changes to Support Tracker are documented in this file.

## [2.7.2] - 2026-02-03

### Changed
- Updated button styles and improved delete button appearance with enhanced visual feedback

## [2.7.1] - 2026-02-03

### Changed
- Updated button styles and added box shadows for improved UI depth

## [2.7.0] - 2026-02-03

### Added
- Hidden scrollbars while maintaining scroll functionality for a cleaner UI

## [2.6.6] - 2026-02-03

### Added
- `onProgress` callback to GitHub and StackOverflow services for real-time progress tracking

## [2.6.5] - 2026-02-03

### Fixed
- Issue URL formatting in GitHub and StackOverflow services for correct linking

## [2.6.4] - 2026-02-03

### Changed
- Updated modal close button appearance for better visibility

## [2.6.3] - 2026-02-03

### Fixed
- Ensured consistent line endings in version file across platforms

## [2.6.2] - 2026-02-03

### Changed
- Improved version update logic and migrateSecrets script reliability

## [2.6.1] - 2026-02-03

### Changed
- Removed unnecessary `refreshSettings` call in Landing component for better performance

## [2.6.0] - 2026-02-03

### Added
- Enhanced settings validation on unsaved changes with user prompts

## [2.5.0] - 2026-02-03

### Added
- Service key validation for Azure DevOps, GitHub, and Stack Overflow
- Validation routes and UI components for credential verification

## [2.4.0] - 2026-02-02

### Added
- Developer Tools tab for debugging
- About tab with application information
- Version update script for automated versioning
- Enhanced settings validation

## [2.3.0] - 2026-02-02

### Added
- Build verification system
- Missing fields indicator in settings
- Enhanced settings validation with visual feedback

## [2.2.0] - 2026-01-29

### Changed
- Refactored code structure for improved readability and maintainability

### Added
- TopBar component with date, time, and settings button
- Enhanced credential management and updated service integrations

## [2.1.12] - 2024-12-05

### Changed
- Refactored error handling and streamlined service response management

## [2.1.11] - 2024-12-04

### Changed
- Updated index.html handling and integrated open-web-browser utility

### Removed
- Deprecated 'open' package from dependencies

## [2.1.10] - 2024-12-04

### Changed
- Streamlined index.html creation process

## [2.1.9] - 2024-11-27

### Changed
- Enhanced error handling and improved verbosity in issue processing

## [2.1.8] - 2024-11-27

### Changed
- Increased sleep duration in issue fetching for StackOverflow services to improve rate limiting

## [2.1.7] - 2024-11-26

### Changed
- Refactored GitHub and StackOverflow service error handling and issue processing

## [2.1.6] - 2024-11-13

### Added
- Set-verbosity command to enable/disable verbose logging

### Changed
- Updated dependencies and enhanced error handling and logging

## [2.1.5] - 2024-11-08

### Changed
- Refactored createIndex.js and index.js for improved maintainability

## [2.1.4] - 2024-11-08

### Fixed
- Refactored errant console.log statement in index.js

## [2.1.3] - 2024-11-08

### Changed
- Refactored CLI tool and updated command usage
- Updated .gitignore and JSON storage handling

## [2.1.2] - 2024-10-28

### Added
- CLI flow for command-line usage

## [2.1.1] - 2024-10-24

### Changed
- Updated client flow for better service integration

## [2.1.0] - 2024-09-20

### Added
- Support for index.html output generation

### Changed
- Removed index.html from repository tracking
- Added index.json to .gitignore

## [2.0.2] - 2024-09-17

### Changed
- Updated services flow with test data checking
- Improved service integration and error handling

## [2.0.1] - 2024-08-26

### Changed
- Corrections to process flow, query time, and logging
- Updated logging and corrected output formatting

## [2.0.0] - 2024-08-15

### Added
- Initial release of Support Tracker v2
- GitHub issue querying support
- Stack Overflow question querying
- Internal Stack Overflow integration
- Azure DevOps work item creation
- Electron desktop application
- React-based user interface
- Secure credential storage with keytar
- JSON-based settings storage
