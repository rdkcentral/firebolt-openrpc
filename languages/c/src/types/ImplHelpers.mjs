const Indent = '\t'

const getSdkNameSpace = () => 'FireboltSDK'
const wpeJsonNameSpace = () => 'WPEFramework::Core::JSON'
const getFireboltStringType = () => 'FireboltTypes_StringHandle'

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

const getArrayAccessorsImpl = (objName, propertyName, propertyType, json = {}, options = {readonly:false, optional:false}) => {
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

export {
    getArrayAccessorsImpl,
    getMapAccessorsImpl,
    getObjectHandleManagementImpl,
    getPropertyAccessorsImpl
}
