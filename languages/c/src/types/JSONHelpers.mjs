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

export {
    getJsonContainerDefinition
}
