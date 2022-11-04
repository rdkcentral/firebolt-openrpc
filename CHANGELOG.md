# [1.7.0-next.5](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0-next.4...v1.7.0-next.5) (2022-11-04)


### Bug Fixes

* Reverted code of Fire-52 ([#73](https://github.com/rdkcentral/firebolt-openrpc/issues/73)) ([c599e62](https://github.com/rdkcentral/firebolt-openrpc/commit/c599e6299cae33d03ee2ac189746fb73381bbbdc))

# [1.7.0-next.4](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0-next.3...v1.7.0-next.4) (2022-11-04)


### Bug Fixes

* Updated logic to return error on failing to listen the events ([#65](https://github.com/rdkcentral/firebolt-openrpc/issues/65)) ([846709e](https://github.com/rdkcentral/firebolt-openrpc/commit/846709ea0ce22cba60a95ebfd0e02872f3756e57))

# [1.7.0-next.3](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0-next.2...v1.7.0-next.3) (2022-10-31)


### Bug Fixes

* Only generate docs for used schema files ([ff08978](https://github.com/rdkcentral/firebolt-openrpc/commit/ff08978477ef8eb048c9f4c9d9a96e2fe66fc868))

# [1.7.0-next.2](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0-next.1...v1.7.0-next.2) (2022-10-31)


### Bug Fixes

* Interfaceless providers ([#68](https://github.com/rdkcentral/firebolt-openrpc/issues/68)) ([ceb3040](https://github.com/rdkcentral/firebolt-openrpc/commit/ceb304018c2e0eb7cf5ac6f9bcd5b44bab0cb083))

# [1.7.0-next.1](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.6.2-next.1...v1.7.0-next.1) (2022-10-24)


### Features

* Context Params and Request Methods ([d36586e](https://github.com/rdkcentral/firebolt-openrpc/commit/d36586e76ce5ff864012a97be10c71123f97f191))

## 1.7.0-next

### Features

- Context Parameters
- Response Methods

### Bug Fixes

* $ref usage in context parameters ([906eeb6](https://github.com/rdkcentral/firebolt-openrpc/commit/906eeb6c3750594dd18e0c88a4ad86d22ad13897))
* JSONRPC docs for provider response has invalid format ([#61](https://github.com/rdkcentral/firebolt-openrpc/issues/61)) ([34ddeaf](https://github.com/rdkcentral/firebolt-openrpc/commit/34ddeaf7345074a894f901464d366b6eb4488e51))
* multiple provider doc headers for same module are broken ([#56](https://github.com/rdkcentral/firebolt-openrpc/issues/56)) ([e63928f](https://github.com/rdkcentral/firebolt-openrpc/commit/e63928f5160c9d4227f3207c8a7c90495245ff7a))
* $ref usage in context parameters ([906eeb6](https://github.com/rdkcentral/firebolt-openrpc/commit/906eeb6c3750594dd18e0c88a4ad86d22ad13897))
* JSONRPC docs for provider response has invalid format ([#61](https://github.com/rdkcentral/firebolt-openrpc/issues/61)) ([34ddeaf](https://github.com/rdkcentral/firebolt-openrpc/commit/34ddeaf7345074a894f901464d366b6eb4488e51))
* multiple provider doc headers for same module are broken ([#56](https://github.com/rdkcentral/firebolt-openrpc/issues/56)) ([e63928f](https://github.com/rdkcentral/firebolt-openrpc/commit/e63928f5160c9d4227f3207c8a7c90495245ff7a))

# 1.5.0

- Much more beautiful validation error messages
- Moved Transport Layer API out of `src/templates` and into `src/js`
- Exporting Transport Layer API for use by Firebolt Developer Tools
- Support for `x-provides` and Provider patter
- Added basic "Firebolt" validation, e.g. require at least one example
- Support for `temporal-set` method generation
- Support for `property` methods that have setters
- Changed JSON-Schema `integer` mapping to `Number` since `bigint` isn't supported in JSON natively
