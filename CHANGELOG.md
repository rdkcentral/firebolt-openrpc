## [1.7.1-next.3](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.1-next.2...v1.7.1-next.3) (2022-11-18)


### Bug Fixes

* Removes extra string added to params table ([0d51872](https://github.com/rdkcentral/firebolt-openrpc/commit/0d5187266a1466cefded2ac50a7e44aa4ef1a2df))

## [1.7.1-next.2](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.1-next.1...v1.7.1-next.2) (2022-11-18)


### Bug Fixes

* Improper null check of value ([eed458c](https://github.com/rdkcentral/firebolt-openrpc/commit/eed458c57eb8ba5701ea86097338041b79f88848))

## [1.7.1-next.1](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0...v1.7.1-next.1) (2022-11-18)


### Bug Fixes

* Capabilities for property setters to be manages instead of uses ([#77](https://github.com/rdkcentral/firebolt-openrpc/issues/77)) ([a2fa157](https://github.com/rdkcentral/firebolt-openrpc/commit/a2fa157fac3ace0c3cec9f283b59bc4768e17373))
* Properly document context params ([#75](https://github.com/rdkcentral/firebolt-openrpc/issues/75)) ([325858c](https://github.com/rdkcentral/firebolt-openrpc/commit/325858c98116edd4708eacce644bbdb95a2e18e4))
* Trigger semantic release ([bb2ab26](https://github.com/rdkcentral/firebolt-openrpc/commit/bb2ab26b76e7515c0770f79d0ea65a436c930915))

# [1.7.0-next.7](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0-next.6...v1.7.0-next.7) (2022-11-18)


### Bug Fixes

* Trigger semantic release ([bb2ab26](https://github.com/rdkcentral/firebolt-openrpc/commit/bb2ab26b76e7515c0770f79d0ea65a436c930915))

# [1.7.0-next.6](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0-next.5...v1.7.0-next.6) (2022-11-18)


### Bug Fixes

* Capabilities for property setters to be manages instead of uses ([#77](https://github.com/rdkcentral/firebolt-openrpc/issues/77)) ([a2fa157](https://github.com/rdkcentral/firebolt-openrpc/commit/a2fa157fac3ace0c3cec9f283b59bc4768e17373))
* Properly document context params ([#75](https://github.com/rdkcentral/firebolt-openrpc/issues/75)) ([325858c](https://github.com/rdkcentral/firebolt-openrpc/commit/325858c98116edd4708eacce644bbdb95a2e18e4))

## 1.7.0

### Features

* Only generate docs for used schema files ([ff08978](https://github.com/rdkcentral/firebolt-openrpc/commit/ff08978477ef8eb048c9f4c9d9a96e2fe66fc868))
* Context Params and Request Methods ([d36586e](https://github.com/rdkcentral/firebolt-openrpc/commit/d36586e76ce5ff864012a97be10c71123f97f191))

### Bug Fixes

* $ref usage in context parameters ([906eeb6](https://github.com/rdkcentral/firebolt-openrpc/commit/906eeb6c3750594dd18e0c88a4ad86d22ad13897))
* JSONRPC docs for provider response has invalid format ([#61](https://github.com/rdkcentral/firebolt-openrpc/issues/61)) ([34ddeaf](https://github.com/rdkcentral/firebolt-openrpc/commit/34ddeaf7345074a894f901464d366b6eb4488e51))
* multiple provider doc headers for same module are broken ([#56](https://github.com/rdkcentral/firebolt-openrpc/issues/56)) ([e63928f](https://github.com/rdkcentral/firebolt-openrpc/commit/e63928f5160c9d4227f3207c8a7c90495245ff7a))
* $ref usage in context parameters ([906eeb6](https://github.com/rdkcentral/firebolt-openrpc/commit/906eeb6c3750594dd18e0c88a4ad86d22ad13897))
* JSONRPC docs for provider response has invalid format ([#61](https://github.com/rdkcentral/firebolt-openrpc/issues/61)) ([34ddeaf](https://github.com/rdkcentral/firebolt-openrpc/commit/34ddeaf7345074a894f901464d366b6eb4488e51))
* multiple provider doc headers for same module are broken ([#56](https://github.com/rdkcentral/firebolt-openrpc/issues/56)) ([e63928f](https://github.com/rdkcentral/firebolt-openrpc/commit/e63928f5160c9d4227f3207c8a7c90495245ff7a))

## 1.5.0

- Much more beautiful validation error messages
- Moved Transport Layer API out of `src/templates` and into `src/js`
- Exporting Transport Layer API for use by Firebolt Developer Tools
- Support for `x-provides` and Provider patter
- Added basic "Firebolt" validation, e.g. require at least one example
- Support for `temporal-set` method generation
- Support for `property` methods that have setters
- Changed JSON-Schema `integer` mapping to `Number` since `bigint` isn't supported in JSON natively
