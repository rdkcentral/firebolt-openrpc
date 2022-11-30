## [1.7.1](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.7.0...v1.7.1) (2022-11-30)


### Bug Fixes

* Capabilities for property setters to be manages instead of uses ([#77](https://github.com/rdkcentral/firebolt-openrpc/issues/77)) ([6f516e7](https://github.com/rdkcentral/firebolt-openrpc/commit/6f516e7ef32cf4a8de78b8ccb5992805d8b57c5b))
* Improper null check of value ([85f77d8](https://github.com/rdkcentral/firebolt-openrpc/commit/85f77d8d10c6170c67ba642307cb12fd145e255e))
* Properly document context params ([#75](https://github.com/rdkcentral/firebolt-openrpc/issues/75)) ([ca0f581](https://github.com/rdkcentral/firebolt-openrpc/commit/ca0f5811dca8016d147a1a012fca8518107f65a1))
* Removes extra string added to params table ([cb9f35f](https://github.com/rdkcentral/firebolt-openrpc/commit/cb9f35f2e2cb70504b078b17ecb3a08b17c97359))

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
