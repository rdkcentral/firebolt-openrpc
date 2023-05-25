const capitalize = str => str[0].toUpperCase() + str.substr(1)
const getSdkNameSpace = () => 'FireboltSDK'
const getJsonDataPrefix = () => 'JsonData_'
const wpeJsonNameSpace = () => 'WPEFramework::Core::JSON'

const getJsonDataStructName = (modName, name, prefixName = '') => {
  let result =((prefixName.length > 0) && (capitalize(prefixName) != capitalize(name))) ? `${capitalize(modName)}::${getJsonDataPrefix()}${capitalize(prefixName)}${capitalize(name)}` : `${capitalize(modName)}::${getJsonDataPrefix()}${capitalize(name)}`

  return ((result.includes(wpeJsonNameSpace()) === true) ? result : `${getSdkNameSpace()}::${result}`)
}

function getJsonContainerDefinition (schema, name, props) {
  let c = schema.description ? ('    /*\n     * ${info.title} - ' + `${schema.description}\n     */\n`) : ''
  name = getJsonDataPrefix() + capitalize(name)
  c += `    class ${name}: public WPEFramework::Core::JSON::Container {
    public:
        ~${name}() override = default;
  
    public:
        ${name}()
            : WPEFramework::Core::JSON::Container()
        {`
  
  props.forEach(prop => {
    c += `\n            Add(_T("${prop.name}"), &${capitalize(prop.name)});`
  })
  c += `\n        }\n`
  c += `\n        ${name}(const ${name}& copy)
        {`
  props.forEach(prop => {
    c += `\n            Add(_T("${prop.name}"), &${capitalize(prop.name)});`
    c += `\n            ${capitalize(prop.name)} = copy.${capitalize(prop.name)};`
  })
  c += `
        }\n
        ${name}& operator=(const ${name}& rhs)
        {`
  props.forEach(prop => {
    c += `\n            ${capitalize(prop.name)} = rhs.${capitalize(prop.name)};`
  })
  c += `\n            return (*this);
        }\n
    public:`
  
  props.forEach(prop => {
    c += `\n        ${prop.type} ${capitalize(prop.name)};`
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

function getJsonEnumConversion(schema, { name }) {
    name = (schema.title || name)
    let e = schema.description ? ('\n/* ${info.title} - ' + `${schema.description} */`) : ''
    e += '\nENUM_CONVERSION_BEGIN(${info.title}_' + `${name})\n`
    schema.enum.forEach(value => {
        e += '    { ${info.TITLE}_' + `${name.toUpperCase()}_${keyName(value)}, _T("${value}") },\n`
    })

    e += 'ENUM_CONVERSION_END(${info.title}_' + `${name})`

    return e
}

export {
    getJsonContainerDefinition,
    getJsonEnumConversion,
    getJsonDataStructName
}
