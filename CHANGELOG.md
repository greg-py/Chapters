# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [3.2.1](https://github.com/greg-py/Chapters/compare/v3.2.0...v3.2.1) (2025-05-21)


### Bug Fixes

* resolved issue with error message in voting phase automatic phase transition ([bc83e4e](https://github.com/greg-py/Chapters/commit/bc83e4e97325f8047910d9f89c5a97f79632e34a))


### Chores

* added unit tests for utils files ([53b8d0a](https://github.com/greg-py/Chapters/commit/53b8d0a24c5132ebe4f17e88e5efe87b239249c8))

## [3.2.0](https://github.com/greg-py/Chapters/compare/v3.1.8...v3.2.0) (2025-05-21)


### Features

* added a tie breaking mechanism for transitioning from voting phase ([477c296](https://github.com/greg-py/Chapters/commit/477c296735e48a8919c64238ec05ad7d7b97d071))
* added automatic phase transition when all users have voted ([ad1c053](https://github.com/greg-py/Chapters/commit/ad1c053544f7400397b67b83da5a92e0453d89a0))

### [3.1.8](https://github.com/greg-py/Chapters/compare/v3.1.7...v3.1.8) (2025-05-20)


### Bug Fixes

* updated bot token environment variable name ([37ab87b](https://github.com/greg-py/Chapters/commit/37ab87bbd89ba621c789d38512a98bbfe4c854a2))

### [3.1.7](https://github.com/greg-py/Chapters/compare/v3.1.6...v3.1.7) (2025-05-20)


### Bug Fixes

* added config for slack client in serverless environment ([3b6596e](https://github.com/greg-py/Chapters/commit/3b6596eae1c7d6e390d50498ab0f8821a3fe955a))

### [3.1.6](https://github.com/greg-py/Chapters/compare/v3.1.5...v3.1.6) (2025-05-20)


### Bug Fixes

* updated vercel json to include cron route ([4a78705](https://github.com/greg-py/Chapters/commit/4a78705b280cdd2aa6e26f9f1bfcfe8db73a5952))

### [3.1.5](https://github.com/greg-py/Chapters/compare/v3.1.4...v3.1.5) (2025-05-20)


### Bug Fixes

* updated return of express app for serverless ([cc33fd8](https://github.com/greg-py/Chapters/commit/cc33fd801bbf4e02b8b59a089c5b4e75b8a9e65a))

### [3.1.4](https://github.com/greg-py/Chapters/compare/v3.1.3...v3.1.4) (2025-05-20)


### Bug Fixes

* Update serverless function call to daily ([1d8e7b5](https://github.com/greg-py/Chapters/commit/1d8e7b5fccdfd59818465e80776e0baad9162cf4))

### [3.1.3](https://github.com/greg-py/Chapters/compare/v3.1.2...v3.1.3) (2025-05-20)


### Chores

* added configuration for phase transition service in serverless environment ([c4b179a](https://github.com/greg-py/Chapters/commit/c4b179af79b904914d8e03362e3f2d5d43c753c2))

### [3.1.2](https://github.com/greg-py/Chapters/compare/v3.1.1...v3.1.2) (2025-05-20)


### Chores

* Added logging for phase transition service ([777b00b](https://github.com/greg-py/Chapters/commit/777b00ba0c177dc5635e9e79b9e8cf7050965fb7))

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
