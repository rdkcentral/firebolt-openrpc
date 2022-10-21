# 1.6.0
 
- Convert all unit tests to TypeScript
- Docs generation Clean-up (schemas, etc.)
- Temporal Set methods, e.g. DeveloperTools.find()
- Provider APIs
- Support for static declarations template
- Bugfix: remove unit test global object
- Bugfix: include external schemas in declarations

# 1.5.0

- Much more beautiful validation error messages
- Moved Transport Layer API out of `src/templates` and into `src/js`
- Exporting Transport Layer API for use by Firebolt Developer Tools
- Support for `x-provides` and Provider patter
- Added basic "Firebolt" validation, e.g. require at least one example
- Support for `temporal-set` method generation
- Support for `property` methods that have setters
- Changed JSON-Schema `integer` mapping to `Number` since `bigint` isn't supported in JSON natively