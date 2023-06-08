import { getModuleName, getPropertyGetterSignature, getPropertySetterSignature,
         getPropertyEventSignature, getPropertyEventCallbackSignature, getPropertyEventInnerCallbackSignature,
         getEventSignature, getEventCallbackSignature, getEventInnerCallbackSignature,
         getFireboltStringType, getSdkNameSpace, capitalize, description } from './NativeHelpers.mjs'

const getObjectHandleManagementImpl = (varName, jsonDataName) => {

  let result = `${varName}Handle ${varName}Handle_Create(void)
{
    WPEFramework::Core::ProxyType<${jsonDataName}>* type = new WPEFramework::Core::ProxyType<${jsonDataName}>();
    *type = WPEFramework::Core::ProxyType<${jsonDataName}>::Create();
    return (static_cast<${varName}Handle>(type));
}
void ${varName}Handle_Addref(${varName}Handle handle)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());
    var->AddRef();
}
void ${varName}Handle_Release(${varName}Handle handle)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    var->Release();
    if (var->IsValid() != true) {
        delete var;
    }
}
bool ${varName}Handle_IsValid(${varName}Handle handle)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${jsonDataName}>* var = static_cast<WPEFramework::Core::ProxyType<${jsonDataName}>*>(handle);
    ASSERT(var->IsValid());
    return var->IsValid();
}
`
  return result
}

const getPropertyAccessorsImpl = (objName, modulePropertyType, subPropertyType, subPropertyName, accessorPropertyType, json = {}, options = {readonly:false, optional:false}) => {
  let result = ''
  result += `${accessorPropertyType} ${objName}_Get_${subPropertyName}(${objName}Handle handle)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());
` + '\n'
  if ((json.type === 'object') && (accessorPropertyType !== 'char*')) {
    result += `    WPEFramework::Core::ProxyType<${subPropertyType}>* element = new WPEFramework::Core::ProxyType<${subPropertyType}>();
    *element = WPEFramework::Core::ProxyType<${subPropertyType}>::Create();
    *(*element) = (*var)->${subPropertyName};
    return (static_cast<${accessorPropertyType}>(element));` + '\n'
  }
  else {
    if ((typeof json.const === 'string') || (json.type === 'string' && !json.enum) || (accessorPropertyType === 'char*')) {
      result += `    return (const_cast<${accessorPropertyType}>((*var)->${subPropertyName}.Value().c_str()));` + '\n'
    }
    else {
      result += `    return (static_cast<${accessorPropertyType}>((*var)->${subPropertyName}.Value()));` + '\n'
    }
  }
  result += `}` + '\n'

  if (!options.readonly) {
    let type = (accessorPropertyType === getFireboltStringType()) ? 'char*' : accessorPropertyType
    result += `void ${objName}_Set_${subPropertyName}(${objName}Handle handle, ${type} value)\n{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());
` + '\n'

    if (json.type === 'object' && (accessorPropertyType !== 'char*')) {
      result += `    WPEFramework::Core::ProxyType<${subPropertyType}>* object = static_cast<WPEFramework::Core::ProxyType<${subPropertyType}>*>(value);
    (*var)->${subPropertyName} = *(*object);` + '\n'
    }
    else {
      result += `    (*var)->${subPropertyName} = value;` + '\n'
    }
    result += `}` + '\n'
  }

  if (options.optional === true) {
    result += `bool ${objName}_Has_${subPropertyName}(${objName}Handle handle)\n{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());

    return ((*var)->${subPropertyName}.IsSet());
}` + '\n'
    result += `void ${objName}_Clear_${subPropertyName}(${objName}Handle handle)\n{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());
    ((*var)->${subPropertyName}.Clear());
}` + '\n'
  }

  return result
}
const getArrayAccessorsImpl = (objName, modulePropertyType, objHandleType, subPropertyType, subPropertyName, accessorPropertyType, json = {}) => {

  let propertyName
  if (subPropertyName) {
     propertyName = '(*var)->' + `${subPropertyName}`
     objName = objName + '_' + subPropertyName
  }
  else {
     propertyName = '(*(*var))'
  }

  let result = `uint32_t ${objName}Array_Size(${objHandleType} handle) {
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());

    return (${propertyName}.Length());
}` + '\n'

  result += `${accessorPropertyType} ${objName}Array_Get(${objHandleType} handle, uint32_t index)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());` + '\n'

  if ((json.type === 'object') || (json.type === 'array')) {
    result += `WPEFramework::Core::ProxyType<${subPropertyType}>* object = new WPEFramework::Core::ProxyType<${subPropertyType}>();
    *object = WPEFramework::Core::ProxyType<${subPropertyType}>::Create();
    *(*object) = ${propertyName}.Get(index);

    return (static_cast<${accessorPropertyType}>(object));` + '\n'
  }
  else {
    if ((typeof json.const === 'string') || (json.type === 'string' && !json.enum)) {
      result += `    return (const_cast<${accessorPropertyType}>(${propertyName}.Get(index).Value().c_str()));` + '\n'
    }
    else {
      result += `    return (static_cast<${accessorPropertyType}>(${propertyName}.Get(index)));` + '\n'
    }
  }
  result += `}` + '\n'

  let type = (accessorPropertyType === getFireboltStringType()) ? 'char*' : accessorPropertyType
  result += `void ${objName}Array_Add(${objHandleType} handle, ${type} value)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());` + '\n'

  if ((json.type === 'object') || (json.type === 'array')) {
   result += `    ${subPropertyType}& element = *(*(static_cast<WPEFramework::Core::ProxyType<${subPropertyType}>*>(value)));` + '\n'
  }
  else {
    result += `    ${subPropertyType} element(value);` + '\n'
  }
  result += `
    ${propertyName}.Add(element);
}` + '\n'

  result += `void ${objName}Array_Clear(${objHandleType} handle)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${modulePropertyType}>* var = static_cast<WPEFramework::Core::ProxyType<${modulePropertyType}>*>(handle);
    ASSERT(var->IsValid());

    ${propertyName}.Clear();
}` + '\n'

  return result
}

const getMapAccessorsImpl = (objName, containerType, subPropertyType, accessorPropertyType, json = {}, options = {readonly:false, optional:false}) => {
  let result = `uint32_t ${objName}_KeysCount(${objName}Handle handle)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${containerType}>* var = static_cast<WPEFramework::Core::ProxyType<${containerType}>*>(handle);
    ASSERT(var->IsValid());
    ${containerType}::Iterator elements = (*var)->Variants();
    uint32_t count = 0;
    while (elements.Next()) {
        count++;
    }
    return (count);
}`  + '\n'
  result += `void ${objName}_AddKey(${objName}Handle handle, char* key, ${accessorPropertyType} value)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${containerType}>* var = static_cast<WPEFramework::Core::ProxyType<${containerType}>*>(handle);
    ASSERT(var->IsValid());
` + '\n'
    let elementContainer = subPropertyType
    if (containerType.includes('VariantContainer')) {
      elementContainer = 'WPEFramework::Core::JSON::Variant'
    }
    if ((json.type === 'object') || (json.type === 'array' && json.items)) {
      if (containerType.includes('VariantContainer')) {
        result += `    ${subPropertyType}& container = *(*(static_cast<WPEFramework::Core::ProxyType<${subPropertyType}>*>(value)));` + '\n'
        result += `    string containerStr;` + '\n'
        result += `    element.ToString(containerStr);` + '\n'
        result += `    WPEFramework::Core::JSON::VariantContainer containerVariant(containerStr);` + '\n'
        result += `    WPEFramework::Core::JSON::Variant element = containerVariant;` + '\n'
      }
      else {
        result += `    ${subPropertyType}& element = *(*(static_cast<WPEFramework::Core::ProxyType<${subPropertyType}>*>(value)));` + '\n'
      }
    } else {
      result += `    ${elementContainer} element(value);` + '\n'
    }
    result += `    (*var)->Set(const_cast<const char*>(key), element);
}` + '\n'

  result += `void ${objName}_RemoveKey(${objName}Handle handle, char* key)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${containerType}>* var = static_cast<WPEFramework::Core::ProxyType<${containerType}>*>(handle);
    ASSERT(var->IsValid());

    (*var)->Remove(key);
}` + '\n'

    result += `${accessorPropertyType} ${objName}_FindKey(${objName}Handle handle, char* key)
{
    ASSERT(handle != NULL);
    WPEFramework::Core::ProxyType<${containerType}>* var = static_cast<WPEFramework::Core::ProxyType<${containerType}>*>(handle);
    ASSERT(var->IsValid());` + '\n'
    if ((json.type === 'object') || (json.type === 'array') ||
        ((json.type === 'string' || (typeof json.const === 'string')) && !json.enum)) {
        result += `    ${accessorPropertyType} status = nullptr;` + '\n'
    }
    else if (json.type === 'boolean') {
        result += `    ${accessorPropertyType} status = false;` + '\n'
    }
    else {
        result += `    ${accessorPropertyType} status = 0;` + '\n'
    }

    result += `
    if ((*var)->HasLabel(key) == true) {`
    if (json.type === 'object') {
      result += `
        string objectStr;
        (*var)->Get(key).Object().ToString(objectStr);
	       ${subPropertyType} objectMap;
        objectMap.FromString(objectStr);

        WPEFramework::Core::ProxyType<${subPropertyType}>* element = new WPEFramework::Core::ProxyType<${subPropertyType}>();
        *element = WPEFramework::Core::ProxyType<${subPropertyType}>::Create();
        *(*element) = objectMap;

        status = (static_cast<${accessorPropertyType}>(element));` + '\n'
    }
    else if (json.type === 'array' && json.items) {
      result += `
        WPEFramework::Core::ProxyType<${subPropertyType}>* element = new WPEFramework::Core::ProxyType<${subPropertyType}>();
        *element = WPEFramework::Core::ProxyType<${subPropertyType}>::Create();
        *(*element) = (*var)->Get(key).Array();
        status = (static_cast<${accessorPropertyType}>(element));` + '\n'
    }
    else {
      if (json.type === 'string' || (typeof json.const === 'string')) {
        if (json.enum) {
          result += `
        status = (const_cast<${accessorPropertyType}>((*var)->Get(key).));` + '\n'
        }
        else {
          result += `
        status = (const_cast<${accessorPropertyType}>((*var)->Get(key).String().c_str()));` + '\n'
        }
      }
      else if (json.type === 'boolean') {
        result += `
        status = (static_cast<${accessorPropertyType}>((*var)->Get(key).Boolean()));` + '\n'
	            }
      else if (json.type === 'number') {
        result += `
        status = (static_cast<${accessorPropertyType}>((*var)->Get(key).Float()));` + '\n'
      }
      else if (json.type === 'integer') {
        result += `
        status = (static_cast<${accessorPropertyType}>((*var)->Get(key).Number()));` + '\n'
      }
    }
  result += `    }
    return status;
}`

  return result
}

const IsCallsMetricsMethod = (method) => (method && method.tags && method.tags.find(t => t.name === 'calls-metrics') ? true : false)
const hasCallsMetricsMethods = (json) => {
  let callsMetricsMethods = json.methods && json.methods.filter( m => m.tags && m.tags.find(t => t.name.includes('calls-metrics')))
  return (callsMetricsMethods && (callsMetricsMethods.length > 0))
}

const getCallsMetricsImpl = (module, method, resultJsonType, prefixName = '') => {
  let impl = ''
  if (IsCallsMetricsMethod(method) === true) {

    let methodName = 'Metrics_' + capitalize(method.name)
    if (resultJsonType.type.length > 0 && method.result.schema.type !== 'boolean') {

      impl += `            void* ${method.result.name} = static_cast<void*>(new ${resultJsonType.type});\n`
      impl += `            WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch> job = WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch>(WPEFramework::Core::ProxyType<FireboltSDK::Worker>::Create(${methodName}Dispatcher, ${method.result.name}));\n`
    }
    else {

      impl += `            WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch> job = WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch>(WPEFramework::Core::ProxyType<FireboltSDK::Worker>::Create(${methodName}Dispatcher, nullptr));\n`
    }
    impl += `            WPEFramework::Core::IWorkerPool::Instance().Submit(job);\n`
  }

  return impl
}

function getPropertyParams(paramList) {
  let impl = `    JsonObject jsonParameters;\n`
  paramList.params.forEach(param => {
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

function getPropertyGetterImpl(property, module, propType, container, info) {

  let methodName = getModuleName(module).toLowerCase() + '.' + property.name
  let impl = ''

  let structure = getPropertyGetterSignature(property, module, info)
  structure.signatures.forEach(s => {
    impl += `${s.signature}\n{\n`
    impl += `    const string method = _T("${methodName}");` + '\n'

    if (container.length) {
      impl += `    ${container} jsonResult;\n`
    }
    if (info.params.length > 0) {
      impl += getPropertyParams(info.params)
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
    impl += getCallsMetricsImpl(module, property, container)
    impl += '    }' + '\n'
    impl += '    return status;' + '\n'

    impl += `}`
  })

  return impl
}

function getPropertySetterImpl(property, module, propType, container, info) {
  let methodName = getModuleName(module).toLowerCase() + '.' + property.name
  let paramName =  property.result.name || property.name
  let structure = getPropertySetterSignature(property, module, info)
  let impl = `${description(property.name, property.summary)}\n`

  structure.signatures.forEach(s => {
    impl += `${s.signature}\n{\n`
    impl += `    const string method = _T("${methodName}");` + '\n'

    if (info.params.length > 0) {
      impl += getPropertyParams(info.params)
    }
    else {
      impl += `    JsonObject jsonParameters;\n`
    }

    if (propType) {
      if (propType.includes('Handle')) {
        if (structure.params.length > 0) {
          if (propType.includes('Array')) {
            impl += `    WPEFramework::Core::JSON::ArrayType<${container}> paramArray = *(*(static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::ArrayType<${container}>>*>(${paramName})));\n`
            impl += `   WPEFramework::Core::JSON::Variant param = paramArray;`
            impl += `\n    jsonParameters.Set(_T("${paramName}"), param);`
          }
          else {
            impl += `\n    ${container}& ${paramName}Container = *(*(static_cast<WPEFramework::Core::ProxyType<${container}>*>(${paramName})));`
            impl += `\n    WPEFramework::Core::JSON::Variant containerParam = ${paramName}Container;`
            impl += `\n    jsonParameters.Set(_T("${paramName}"), containerParam);`
	  }
        }
      }
      else {
        //ToDo Map?
        impl += `    WPEFramework::Core::JSON::Variant param = ${paramName};`
        impl += `\n    jsonParameters.Set(_T("${paramName}"), param);`
      }
    }

    impl += `\n\n    uint32_t status = ${getSdkNameSpace()}::Properties::Set(method, jsonParameters);`
    impl += `\n    if (status == FireboltSDKErrorNone) { \n
          FIREBOLT_LOG_INFO(${getSdkNameSpace()}::Logger::Category::OpenRPC, ${getSdkNameSpace()}::Logger::Module<${getSdkNameSpace()}::Accessor>(), "${methodName} is successfully set");\n`
    impl += getCallsMetricsImpl(module, property, container)
    impl += `    }
    return status;
}\n`
  })

  return impl
}

function getPropertyEventCallbackImpl(property, module, propType, container, info) {
  return getEventCallbackImplInternal( property, module, propType, container, info, true)
}

function getPropertyEventImpl(property, module, propType, container, info) {
  return getEventImplInternal(property, module, propType, container, info, true)
}

function getEventCallbackImpl(event, module, propType, container, info) {
  return getEventCallbackImplInternal(event, module, propType, container, info, false)
}

function getEventImpl(event, module, propType, container, info) {
  return getEventImplInternal(event, module, propType, container, info, false)
}

function getEventCallbackImplInternal(event, module, propType, container, info, property) {
  let methodName = capitalize(getModuleName(module)) + capitalize(event.name)

  let impl = ''
  if (propType && (propType.length > 0)) {
    let paramType = (propType === 'char*') ? getFireboltStringType() : propType
    let structure = getEventInnerCallbackSignature(event, module, info)
    structure.signatures.forEach(s => {
      if (s.anyOfParam.type) {
         container = s.anyOfParam.refSchema
         paramType = (s.anyOfParam.type === 'char*') ? getFireboltStringType() : s.anyOfParam.type
      }
      impl += `${s.signature}
{` + '\n'

      if (structure.params.length > 0) {
        structure.params.map(p => {
          if (p.required !== undefined) {
            if (p.type !== 'char*') {
              impl += `    ${p.type} ${p.name};\n`
              if (p.required === false) {
               impl += `    ${p.type}* ${p.name}Ptr = nullptr;\n`
              }
            }
            else {
              impl += `     ${getFireboltStringType()} ${p.name};\n`
            }
          }
        })
        impl += `    WPEFramework::Core::ProxyType<${container}>* jsonResponse;\n`
        impl += `    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::VariantContainer>& var = *(static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::VariantContainer>*>(response));

    ASSERT(var.IsValid() == true);
    if (var.IsValid() == true) {
        WPEFramework::Core::JSON::VariantContainer::Iterator elements = var->Variants();

        while (elements.Next()) {
            if (strcmp(elements.Label(), "value") == 0) {
                jsonResponse = new WPEFramework::Core::ProxyType<${container}>();
                string objectStr;
                elements.Current().Object().ToString(objectStr);
                (*jsonResponse)->FromString(objectStr);
            } else if (strcmp(elements.Label(), "context") == 0) {
                WPEFramework::Core::JSON::VariantContainer::Iterator params = elements.Current().Object().Variants();
                while (params.Next()) {\n`
        let contextParams = ''
        structure.params.map(p => {
          if (p.required !== undefined) {
            if (contextParams.length > 0) {
              contextParams += `                    else if (strcmp(elements.Label(), "${p.name}") == 0) {\n`
            }
            else {
              contextParams += `                    if (strcmp(elements.Label(), "${p.name}") == 0) {\n`
            }
            if (p.type === 'char*') {
              contextParams += `                        ${getSdkNameSpace()}::JSON::String* ${p.name}Value = new ${getSdkNameSpace()}::JSON::String();
                        *${p.name}Value = elements.Current().Value().c_str();
                        ${p.name} = &${p.name}Value;\n`
            }
            else if (p.type === 'bool') {
              contextParams += `                        ${p.name} = elements.Current().Boolean();\n`
            }
            else if ((p.type === 'float') || (p.type === 'int32_t')) {
              contextParams += `                        ${p.name} = elements.Current().Number();\n`
            }
            else {
                console.log(`WARNING: wrongt type defined for ${p.name}`)
            }
            if ((p.type !== 'char*') && (p.required === false)) {
              contextParams += `                        ${p.name}Ptr = &${p.name};\n`
            }
            contextParams += `                    }\n`
          }
        })
        impl += contextParams
        impl += `                }
              } else {
                 ASSERT(false);
              }
          }
      }`
      } else {

        impl +=`    WPEFramework::Core::ProxyType<${container}>* jsonResponse = static_cast<WPEFramework::Core::ProxyType<${container}>*>(response);`
	            }
      if (propType) {
        impl +=`

    ASSERT(jsonResponse->IsValid() == true);
    if (jsonResponse->IsValid() == true) {` + '\n'

        if (((propType === 'char*') || (propType === 'FireboltTypes_StringHandle'))) {
           impl +=`        ${container}* jsonStrResponse = new ${container}();
        *jsonStrResponse = *(*jsonResponse);
        jsonResponse->Release();` + '\n\n'
        }

        let CallbackName = ''
        if (property == true) {
          CallbackName = `On${methodName}Changed`
        } else {
          CallbackName = `${methodName}Callback`
        }

        if (s.anyOfParam.json && s.anyOfParam.json.title) {
          CallbackName += '_' + s.anyOfParam.json.title
        }
        impl +=`        ${CallbackName} callback = reinterpret_cast<${CallbackName}>(userCB);` + '\n'
        impl += `        callback(userData, `
        if (structure.params.length > 0) {
          structure.params.map(p => {
            if (p.required !== undefined) {
              if (p.type === 'char*') {
                impl += `static_cast<${getFireboltStringType()}>(${p.name}), `
              }
              else if (p.required === true) {
                impl += `${p.name}, `
              }
              else if (p.required === false) {
                impl += `${p.name}Ptr, `
              }
            }
          })
        }
        if (propType.includes('Handle')) {
          impl += `static_cast<${paramType}>(jsonResponse));` + '\n'
        }
        else if (((propType === 'char*') || (propType === 'FireboltTypes_StringHandle'))) {
          impl += `static_cast<${paramType}>(jsonStrResponse));` + '\n'
        }
        else {
          impl += `static_cast<${paramType}>((*jsonResponse)->Value()));` + '\n'
        }
      }
      impl += `    }
}\n`
    })
  }

  return impl;
}

function getEventImplInternal(event, module, propType, container, info, property, prefix = '') {
  let eventName = getModuleName(module).toLowerCase() + '.' + event.name
  let moduleName = capitalize(getModuleName(module))
  let methodName = moduleName + capitalize(event.name)

  let impl = ''
  if (propType && (propType.length > 0)) {
    let ClassName = ''
    let structure = {}
    if (property) {
      ClassName = "Properties::"
      structure = getPropertyEventSignature(event, module, info)
    } else {
      ClassName = "Event::Instance()."
      structure = getEventSignature(event, module, info)
    }
    structure.signatures.forEach(s => {

      if (s.anyOfParam && s.anyOfParam.type) {
         container = s.anyOfParam.refSchema
      }
      impl += `${description(event.name, 'Listen to updates')}\n`
      impl += `${s.rsig}\n{\n`
      impl += `    const string eventName = _T("${eventName}");\n`
      impl += `    uint32_t status = FireboltSDKErrorNone;\n`
      impl += `    if (userCB != nullptr) {\n`
      if (structure.params.length > 0) {
        impl += getPropertyParams(info.params)
      }
      else {
        impl += `        JsonObject jsonParameters;\n`
      }
      impl += `\n`
      let innerCallbackName = ((s.anyOfParam && s.anyOfParam.json) ? `${methodName}_${s.anyOfParam.json.title}InnerCallback` : `${methodName}InnerCallback`)

      impl += `        status = ${getSdkNameSpace()}::${ClassName}Subscribe<${container}>(eventName, jsonParameters, ${innerCallbackName}, reinterpret_cast<void*>(userCB), userData);`
      impl += `\n    }
    return status;
}\n`
      impl += `${s.unrsig}
{
    return ${getSdkNameSpace()}::${ClassName}Unsubscribe(_T("${eventName}"), reinterpret_cast<void*>(userCB));
}\n`
    })
  }
  return impl
}

export {
    getArrayAccessorsImpl,
    getMapAccessorsImpl,
    getObjectHandleManagementImpl,
    getPropertyAccessorsImpl,
    getPropertyGetterImpl,
    getPropertySetterImpl,
    getPropertyEventCallbackImpl,
    getPropertyEventImpl,
    getEventCallbackImpl,
    getEventImpl
}
