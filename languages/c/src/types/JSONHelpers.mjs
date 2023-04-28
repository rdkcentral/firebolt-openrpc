const capitalize = str => str[0].toUpperCase() + str.substr(1)

function getJsonContainerDefinition (name, props) {
    name = capitalize(name)
    let c = `    class ${name}: public Core::JSON::Container {
          public:
              ${name}(const ${name}&) = delete;
              ${name}& operator=(const ${name}&) = delete;
              ~${name}() override = default;
  
          public:
              ${name}()
                  : Core::JSON::Container()
              {`
  
      props.forEach(prop => {
          c += `\n                Add(_T("${prop.name}"), &${capitalize(prop.name)});`
      })
  
      c += `\n            }\n\n       public:`
  
      props.forEach(prop => {
          c += `\n            ${prop.type} ${capitalize(prop.name)};`
      })
  
      c += '\n    };'
      return c
  }

/*

ENUM_CONVERSION_BEGIN(Advertising_SkipRestriction)
    { ADVERTISING_SKIPRESTRICTION_NONE, _T("none") },
    { ADVERTISING_SKIPRESTRICTION_ADS_UNWATCHED, _T("adsUnwatched") },
    { ADVERTISING_SKIPRESTRICTION_ADS_ALL, _T("adsAll") },
    { ADVERTISING_SKIPRESTRICTION_ALL, _T("all") },
ENUM_CONVERSION_END(Advertising_SkipRestriction)


*/

// TODO - this should be a global function in the main /src/ directory... not part of a language pack
const keyName = val => val.split(':').pop().replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()

function getJsonEnumConversion(schema, module, { name }) {
    name = capitalize(schema.title || name)
    let e = `ENUM_CONVERSION_BEGIN(${module.info.title}_${name})\n`

    schema.enum.forEach(value => {
        e += `{ ${module.info.title.toUpperCase()}_${name.toUpperCase()}_${keyName(value)}, _T("${value}") },`
    })

    e += `ENUM_CONVERSION_END(${module.info.title}_${name})`

    return e
}

export {
    getJsonContainerDefinition,
    getJsonEnumConversion
}
