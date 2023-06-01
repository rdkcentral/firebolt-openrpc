import { getModuleName, getPropertyGetterSignature, description, getFireboltStringType } from './NativeHelpers.mjs'

const getSdkNameSpace = () => 'FireboltSDK'
const getJsonDataPrefix = () => 'JsonData_'

const Indent = '\t'

const getObjectHandleManagementImpl = (varName, jsonDataName) => {

  let result = `
${varName}Handle ${varName}Handle_Create(void) {
    WPEFramework::Core::ProxyType<${jsonDataName}>* type = new WPEFramework::Core::ProxyType<${jsonDataName}>();
    *type = WPEFramework::Core::ProxyType<${jsonDataName}>::Create();
    return (static_cast<${varName}Handle>(type));
}
void ${varName}Handle_Addref(${varName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());
    var->AddRef();
}
void ${varName}Handle_Release(${varName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    var->Release();
    if(var->IsValid() != true) {
        delete var;
    }
}
bool ${varName}Handle_IsValid(${varName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());
    return var->IsValid();
}
`
  return result
}

const getPropertyAccessorsImpl = (objName, propertyName, jsonDataName, propertyType, json = {}, options = {readonly:false, optional:false}) => {

  let result
  if (json.type === 'object') {
    result += `${objName}_${propertyName}Handle ${objName}_Get_${propertyName}(${objName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());

    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* object = new WPEFramework::Core::ProxyType<${objName}::${propertyName}>();
    *object = WPEFramework::Core::ProxyType<${objName}::${propertyName}>::Create();
    *(*object) = (*var)->${propertyName};
    return (static_cast<${objName}_${propertyType}Handle>(object));` + '\n'
  } else if (json.type === 'array') {
      result += `${objName}_${propertyName}ArrayHandle ${objName}_Get_${propertyName}(${objName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());

    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${propertyName}>>* object = new WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${propertyName}>>();
    *object = WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${propertyName}>>::Create();
    *(*object) = (*var)->${propertyName}.Element();
    return (static_cast<${objName}_${propertyType}ArrayHandle>(object));` + '\n'
  } else if (json.enum) {
    result += `${objName}_${propertyName} ${objName}_Get_${propertyName}(${objName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());

    return static_cast<${propertyType}>((*var)->${propertyName}.Value());` + '\n'
  } else {
      result += `${propertyType} ${objName}_Get_${propertyName}(${objName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());` + '\n'
    if (json.type === 'string') {
      result += `
    return static_cast<${propertyType}>((*var)->${propertyName}.Value().c_str());` + '\n'
    } else {
      result += `
    return static_cast<${propertyType}>((*var)->${propertyName}.Value());` + '\n'
    }
  }
   result += `
}` + '\n'
  if (!options.readonly) {
    if (json.type === 'object') {
      result += `${Indent.repeat(options.level)}void ${objName}_Set_${propertyName}(${objName}Handle handle, ${objName}_${propertyName}Handle ${propertyName.toLowerCase()}) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());

    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* object = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(${propertyName.toLowerCase()});
    (*var)->${propertyName} = *(*object);` + '\n'
    }
    if (json.type === 'array') {
      result += `${Indent.repeat(options.level)}void ${objName}_Set_${propertyName}(${objName}Handle handle, ${objName}_${propertyName}ArrayHandle ${propertyName.toLowerCase()}) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>* object = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>*>(${propertyName.toLowerCase()}).Element();
    (*var)->${propertyName} = *(*object);` + '\n'
    } if (json.enum) {
      result += `${Indent.repeat(options.level)}void ${objName}_Set_${propertyName}(${objName}Handle handle, ${objName}_${propertyName} ${propertyName.toLowerCase()}) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());

    (*var)->${propertyName} = static_cast<${propertyType}>(${propertyName.toLowerCase()});` + '\n'
    }
    else {
      result += `${Indent.repeat(options.level)}void ${objName}_Set_${propertyName}(${objName}Handle handle, ${propertyType} ${propertyName.toLowerCase()}) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());

    (*var)->${propertyName} = static_cast<${propertyType}>(${propertyName.toLowerCase()});` + '\n'
    }
result += `}` + '\n'
  }

  if (options.optional === true) {
    result += `${Indent.repeat(options.level)}bool ${objName}_has_${propertyName}(${objName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());
    return ((*var)->${propertyName}.IsSet());
}` + '\n'
    result += `${Indent.repeat(options.level)}void ${objName}_clear_${propertyName}(${objName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());
    ((*var)->${propertyName}.Clear());
}` + '\n'
  }
  return result
}

const getArrayAccessors = (objName, propertyName, propertyType, json = {}, options = {readonly:false, optional:false}) => {
    let result = `
uint32_t ${objName}_${propertyName}Array_Size(${objName}::${propertyName}ArrayHandle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* var = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(handle);
    ASSERT(var->IsValid());

    return ((*var)->Length());
}` + '\n'

  if (json.type === 'object') {
result += `${objName}_${propertyType}Handle ${objName}_${propertyName}Array_Get(${objName}_${propertyName}ArrayHandle handle, uint32_t index) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>* var = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>*>(handle);
    ASSERT(var->IsValid());
    WPEFramework::Core::ProxyType<${objName}::${propertyType}>* object = new WPEFramework::Core::ProxyType<${objName}::${propertyType}>();
    *object = WPEFramework::Core::ProxyType<${objName}::${propertyName}>::Create();
    *(*object) = (*var)->Get(index);
    return (static_cast<${objName}_${propertyType}Handle>(object));` + '\n'
  } else if (json.enum) {
    result += `${objName}_${propertyType} ${objName}_${propertyName}Array_Get(${objName}_${propertyName}ArrayHandle handle, uint32_t index) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>* var = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>*>(handle);
    ASSERT(var->IsValid());

    return (static_cast<${propertyType}>((*var)->Get(index)));` + '\n'
  } else {
    result += `${propertyType} ${objName}_${propertyName}Array_Get(${objName}_${propertyName}ArrayHandle handle, uint32_t index) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>* var = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>*>(handle);
    ASSERT(var->IsValid());` + '\n'

    if (json.type === 'string') {
      result += `return (static_cast<${propertyType}>((*var)->Get(index).Value().c_str()));` + '\n'
    } else {
      result += `return (static_cast<${propertyType}>((*var)->Get(index)));` + '\n'
    }

  }
  result += `}` + '\n'

  if (json.type === 'object') {
    result += `void ${objName}_${propertyName}Array_Add(${objName}_${propertyName}ArrayHandle handle, ${objName}_${propertyType}Handle value) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>* var = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>*>(handle);
    ASSERT(var->IsValid());
    WPEFramework::Core::ProxyType<${objName}::${propertyType}>* object = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyType}>*>(value);
    
    (*var)->Add(*(*object));` + '\n'
  } else {
     result += `void ${objName}_${propertyName}Array_Add(${objName}_${propertyName}ArrayHandle handle, ${propertyType} value) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>* var = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>*>(handle);
    ASSERT(var->IsValid());` + '\n'
    if (json.type === 'string') {
    result += `WPEFramework::Core::JSON::String element(value);` + '\n'
    } else if (json.type === 'number') {
    result += `WPEFramework::Core::JSON::Number element(value);` + '\n'
    } else if (json.enum) {
    result += `WPEFramework::Core::JSON::EnumType<${propertyType}> element(value);` + '\n'
    }
    result += `(*var)->Add(element);` + '\n'
  }
  result += `}` + '\n'

  result += `void ${objName}_${propertyName}Array_Clear(${objName}_${propertyName}ArrayHandle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>* var = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>*>(handle);
    ASSERT(var->IsValid());
    (*var)->Clear();
}` + '\n'

  return result
}

const getMapAccessors = (objName, propertyName, propertyType, json = {}, options = {readonly:false, optional:false}) => {
  let result = `uint32_t ${objName}_${propertyName}_KeysCount(${objName}_${propertyName}Handle handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* var = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(handle);
    ASSERT(var->IsValid());
    return (*var)->Size());

  }` + '\n'
  result += `void ${objName}_${propertyName}_AddKey(${objName}_${propertyName}Handle handle, char* key, ${propertyType} value) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* var = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(handle);
    ASSERT(var->IsValid());` + '\n'

    if (json.type === 'object') {
      result += `
    (*var)->Add(key, value);` + '\n'
    } else if (json.type === 'boolean') {
      result += `
    WPEFramework::Core::JSON::Boolean element(value);`
    } else if (json.type === 'string') {
      result += `
    WPEFramework::Core::JSON::String element(value);`
    } else if (json.type === 'number') {
      result += `
    WPEFramework::Core::JSON::Number element(value);`
    } else if (json.type === 'array') {
      result += `
    WPEFramework::Core::JSON::ArrayType<propertyType> element(value);`
    } else if (json.enum) {
      result += `
    WPEFramework::Core::JSON::EnumType<propertyType> element(value);
    (*var)->Add(key, element);` + '\n'
    }
  result += `
  }` + '\n'
  result += `void ${objName}_${propertyName}_RemoveKey(${objName}_${propertyName}Handle handle, char* key) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* var = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(handle);
    ASSERT(var->IsValid());
 
    (*var)->Remove(key);
  }` + '\n'

    if (json.type === 'object') {
      result += `${objName}_${propertyType}Handle ${objName}_${propertyName}_FindKey(${objName}_${propertyName}Handle handle, char* key) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* var = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(handle);
    ASSERT(var->IsValid());
    WPEFramework::Core::ProxyType<${objName}::${propertyType}>* object = new WPEFramework::Core::ProxyType<${objName}::${propertyType}>();
    *object = WPEFramework::Core::ProxyType<${objName}::${propertyName}>::Create();
    *(*object) = (*var)->Find(key);
    return (static_cast<${objName}_${propertyType}Handle>(object));` + '\n'

    } else if (json.type === 'array') {
      result += `${objName}_${propertyType}ArrayHandle ${objName}_${propertyName}_FindKey(${objName}_${propertyName}Handle handle, char* key) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* var = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(handle);
    ASSERT(var->IsValid());
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyType}>>* object = new WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyType}>>();
    *object = WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${objName}::${propertyName}>>::Create();
    *(*object) = (*var)->Find(key);
    return (static_cast<${objName}_${propertyType}ArrayHandle>(object));` + '\n'

    } else {
        result += `${propertyType} ${objName}_${propertyName}_FindKey(${objName}_${propertyName}Handle handle, char* key) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${objName}::${propertyName}>* var = static_cast<WPEFramework::Core::ProxyType<${objName}::${propertyName}>*>(handle);
    ASSERT(var->IsValid());` + '\n'
     
      if (json.type === 'string') {
        result += `
    return (static_cast<${propertyType}>((*var)->(Find(key).Value().c_str())));` + '\n'
      } else {
        result += `
    return (static_cast<${propertyType}>((*var)->(Find(key).Value())));` + '\n'
      }
    }
  result += `
}` + '\n'

  return result
}

/*
paramList = [{name='', nativeType='', jsonType='', required=boolean}]
*/
function getPropertyParams(paramList) {
  let impl = `    JsonObject jsonParameters;\n`
  paramList.forEach(param => {
    impl += `\n`
    const jsonType = paramList.jsonType
    if (jsonType.length) {
      if (param.required) {
        if (param.nativeType.includes('FireboltTypes_StringHandle')) {
          impl += `${indents}    WPEFramework::Core::JSON::Variant ${capitalize(param.name)} = *(static_cast<${jsonType}*>(${param.name}));\n`
        }
        else {
          impl += `${indents}    WPEFramework::Core::JSON::Variant ${capitalize(param.name)} = ${param.name};\n`
        }
        impl += `${indents}    jsonParameters.Set(_T("${param.name}"), ${capitalize(param.name)});\n`
      }
      else {
        impl += `${indents}    if (${param.name} != nullptr) {\n`
        if (param.nativeType.includes('char*')) {
          impl += `${indents}        WPEFramework::Core::JSON::Variant ${capitalize(param.name)} = ${param.name};\n`
        } else {

          impl += `${indents}        WPEFramework::Core::JSON::Variant ${capitalize(param.name)} = *(${param.name});\n`
        }
        impl += `${indents}        jsonParameters.Set(_T("${param.name}"), ${capitalize(param.name)});\n`
        impl += `${indents}    }\n`
      }
    }
  })

  return impl
}

/*
paramList = [{name='', nativeType='', jsonType='', required=boolean}]
*/

function getPropertyGetterImpl(property, module, propType, container, paramList = []) {
    
  let methodName = getModuleName(module).toLowerCase() + '.' + property.name
  let impl = ''

  let signature = getPropertyGetterSignature(property, module, propType)
  //impl += `${description(property.name, property.summary)}\n`
  impl += `${signature}\n{\n`
  impl += `    const string method = _T("${methodName}");` + '\n'

  if (container.length) {
    impl += `    ${container} jsonResult;\n`
  }
  if (paramList.length > 0) {
    impl += getPropertyParams(paramList)
    impl += `\n    uint32_t status = ${getSdkNameSpace()}::Properties::Get(method, jsonParameters, jsonResult);`
  } else {
    impl += `\n    uint32_t status = ${getSdkNameSpace()}::Properties::Get(method, jsonResult);`
  }

  impl += `\n    if (status == FireboltSDKErrorNone) {\n`
  if (container.length) {
    impl += `        if (${property.result.name || property.name} != nullptr) {\n`

    if (((propType === 'char*') || (propType === 'FireboltTypes_StringHandle'))) {
      impl += `            ${container}* strResult = new ${container}(jsonResult);` + '\n'
      impl += `            *${property.result.name || property.name} = static_cast<${getFireboltStringType()}>(strResult);` + '\n'
    } else if (propType.includes('Handle')) {
      impl += `            WPEFramework::Core::ProxyType<${container}>* resultPtr = new WPEFramework::Core::ProxyType<${container}>();\n`
      impl += `            *resultPtr = WPEFramework::Core::ProxyType<${container}>::Create();\n`
      impl += `            *(*resultPtr) = jsonResult;\n`
      impl += `            *${property.result.name || property.name} = static_cast<${propType}>(resultPtr);\n`
    } else {
      impl += `            *${property.result.name || property.name} = jsonResult.Value();\n`
    }
    impl += `        }\n`
  }
  impl += '    }' + '\n'
  impl += '    return status;' + '\n'

  impl += `}`


  return impl
}


export {
    getObjectHandleManagementImpl,
    getPropertyAccessorsImpl,
    getPropertyGetterImpl
}
