## [1.4.1-next.1](https://github.com/rdkcentral/firebolt-openrpc/compare/v1.4.0...v1.4.1-next.1) (2022-10-24)


### Bug Fixes

* $ref usage in context parameters ([906eeb6](https://github.com/rdkcentral/firebolt-openrpc/commit/906eeb6c3750594dd18e0c88a4ad86d22ad13897))
* Add jsonrpc as a protocol for websocket transport ([#43](https://github.com/rdkcentral/firebolt-openrpc/issues/43)) ([091ef01](https://github.com/rdkcentral/firebolt-openrpc/commit/091ef01a141e6d5d5231694a162290dc89b73391))
* **bugs:** Provider examples ([0a74e08](https://github.com/rdkcentral/firebolt-openrpc/commit/0a74e0880c175b5a29e5666e0bdf08a2f3b3dd8a))
* docs for jsonrpc in provider ([#54](https://github.com/rdkcentral/firebolt-openrpc/issues/54)) ([a7d62c4](https://github.com/rdkcentral/firebolt-openrpc/commit/a7d62c432eebc3c839b6ae779693932ee0335219))
* JSONRPC docs for provider response has invalid format ([#61](https://github.com/rdkcentral/firebolt-openrpc/issues/61)) ([34ddeaf](https://github.com/rdkcentral/firebolt-openrpc/commit/34ddeaf7345074a894f901464d366b6eb4488e51))
* move any code execution outside of global execution path. Lazily init transport ([#46](https://github.com/rdkcentral/firebolt-openrpc/issues/46)) ([55830ec](https://github.com/rdkcentral/firebolt-openrpc/commit/55830ec56cef9e73b9712ed73f9c81c6403743f8))
* multiple provider doc headers for same module are broken ([#56](https://github.com/rdkcentral/firebolt-openrpc/issues/56)) ([e63928f](https://github.com/rdkcentral/firebolt-openrpc/commit/e63928f5160c9d4227f3207c8a7c90495245ff7a))
* Open-rpc param name should be value for setters ([#45](https://github.com/rdkcentral/firebolt-openrpc/issues/45)) ([54c4d97](https://github.com/rdkcentral/firebolt-openrpc/commit/54c4d97c1789c2339a94612a7906b1f7e859d43b))
* Property setter jsonrpc should follow set{Prop} pattern ([#44](https://github.com/rdkcentral/firebolt-openrpc/issues/44)) ([68080db](https://github.com/rdkcentral/firebolt-openrpc/commit/68080dba85be1a8da5442c60cec1c861997f8ca8))
* Provider pattern jsonrpc docs ([#50](https://github.com/rdkcentral/firebolt-openrpc/issues/50)) ([5cf4be9](https://github.com/rdkcentral/firebolt-openrpc/commit/5cf4be9601469add06ce7585233b9f2f758fba32))
* Provider TOC link ([#36](https://github.com/rdkcentral/firebolt-openrpc/issues/36)) ([80b5448](https://github.com/rdkcentral/firebolt-openrpc/commit/80b54486e21c7a33cfd28f1cef83680f10081a0f))
* When setting boolean properties to false in mock transport, getter is always returning default ([#37](https://github.com/rdkcentral/firebolt-openrpc/issues/37)) ([0936937](https://github.com/rdkcentral/firebolt-openrpc/commit/09369375b25957977aef01ed124b728f85e32e5c))

# 1.5.0

- Much more beautiful validation error messages
- Moved Transport Layer API out of `src/templates` and into `src/js`
- Exporting Transport Layer API for use by Firebolt Developer Tools
- Support for `x-provides` and Provider patter
- Added basic "Firebolt" validation, e.g. require at least one example
- Support for `temporal-set` method generation
- Support for `property` methods that have setters
- Changed JSON-Schema `integer` mapping to `Number` since `bigint` isn't supported in JSON natively
