# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [3.1.1](https://github.com/greg-py/Chapters/compare/v3.1.0...v3.1.1) (2025-05-19)


### Bug Fixes

* Resolved issue with phase deadline warning not running in certain cases ([f637f8f](https://github.com/greg-py/Chapters/commit/f637f8f69edc4ee51b895b20a0dc3a043e5ae620))


### Chores

* add coverage directory to gitignore ([31180c9](https://github.com/greg-py/Chapters/commit/31180c9bbdb4e5133a5cfdf37190bdcf73693fd6))
* Adds foundation for unit test coverage and action to run and require on PRs (closes [#12](https://github.com/greg-py/Chapters/issues/12)) ([2345d4e](https://github.com/greg-py/Chapters/commit/2345d4ea5de456b2570865b8ece6f92d09a4fff9))

## [3.1.0](https://github.com/greg-py/Chapters/compare/v3.0.2...v3.1.0) (2025-05-19)


### Features

* Added phase deadline reminders before automatic phase transition ([f620a1b](https://github.com/greg-py/Chapters/commit/f620a1b74054458781e1fab6909852997f0ebdce))


### Chores

* removed unused schema properties and added migration (resolves [#11](https://github.com/greg-py/Chapters/issues/11)) ([41e9d37](https://github.com/greg-py/Chapters/commit/41e9d3736605b9679c0ddb6a441357d5db3e35be))

### [3.0.2](https://github.com/greg-py/Chapters/compare/v3.0.1...v3.0.2) (2025-05-15)

### [3.0.1](https://github.com/greg-py/Chapters/compare/v3.0.0...v3.0.1) (2025-05-15)


### Bug Fixes

* Updated vercel config to reference routes in dist directory ([9730e70](https://github.com/greg-py/Chapters/commit/9730e701fac09fe94e6d5156e330252cda8e7908))

## [3.0.0](https://github.com/greg-py/Chapters/compare/v2.0.0...v3.0.0) (2025-05-15)


### Bug Fixes

* Modified phase transition service and cycle schema to reference and store phase start times (closes [#10](https://github.com/greg-py/Chapters/issues/10)) ([e9f8c5b](https://github.com/greg-py/Chapters/commit/e9f8c5b7fb4f625fbfb069b4a359102e4f700c6f))


### Code Refactoring

* Adds DTO functions and collection constants, fixes duplicate document IDs (closes [#8](https://github.com/greg-py/Chapters/issues/8)) ([016dab1](https://github.com/greg-py/Chapters/commit/016dab1be0e2e6c9f4e3ba69ec0f12cb6d69babc))
* Refactored server files by combining into single index file and separating utilities and validators ([7370ca2](https://github.com/greg-py/Chapters/commit/7370ca282f1c8fea0e8efee87de1da15327173a6))

## [2.0.0](https://github.com/greg-py/Chapters/compare/v1.2.0...v2.0.0) (2025-05-14)


### Features

* Added functionality to remove ephemeral messages (UIs) on confirmation or cancel to prevent further user interaction ([88336b0](https://github.com/greg-py/Chapters/commit/88336b0fa3a97cdcd7825fc80224f1c7b7b62131))
* New configuration, scripts, and documentation for local development ([4f67676](https://github.com/greg-py/Chapters/commit/4f676767227464cde728c44c4d476d4e9ea0ae22))


### Bug Fixes

* Changed book suggestion cancelation to correct cancel action and updated to delete UI on cancel or successful submission ([624072c](https://github.com/greg-py/Chapters/commit/624072c351e0fba62b8e92165619f12918793663))


### Documentation

* Added a section to the README on development lifecycle ([f02677b](https://github.com/greg-py/Chapters/commit/f02677bcdb67c146d1c9cdaed445bc49e72e4927))

## [1.2.0](https://github.com/greg-py/Chapters/compare/v1.1.0...v1.2.0) (2025-05-13)

## 1.1.0 (2025-05-13)


### Features

* added versioning system to application ([b8031ed](https://github.com/greg-py/Chapters/commit/b8031edc08127ba4fd96e0351ee2c9976137eee9))
