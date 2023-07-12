const capitalize = str => str[0].toUpperCase() + str.substr(1)
const getSdkNameSpace = () => 'FireboltSDK'
const getJsonDataPrefix = () => 'JsonData_'
const wpeJsonNameSpace = () => 'WPEFramework::Core::JSON'

const getJsonDataStructName = (modName, name, prefix = '') => {
  let result =((prefix.length > 0) && (!name.startsWith(prefix)))  ? `${capitalize(modName)}::${getJsonDataPrefix()}${capitalize(prefix)}_${capitalize(name)}` : `${capitalize(modName)}::${getJsonDataPrefix()}${capitalize(name)}`

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

export {
    getJsonContainerDefinition,
    getJsonDataStructName,
    getJsonDataPrefix
}
