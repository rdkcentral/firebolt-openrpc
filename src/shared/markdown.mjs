const getFilename = (json, asPath) => (json.info ? json.info.title : (asPath ? json.title : json.title + 'Schema'))
const getDirectory = (json, asPath) => asPath ? json.info ? '' : 'schemas' : ''
const getLinkFromRef = (ref, schemas = {}, asPath) => path.join((asPath ? 'schemas' : ''), getFilename(getSchema(ref.split('#')[0], schemas), asPath)) + (ref.includes('#') ? '#' + ref.split('#')[1] : '')

export {
    getFilename,
    getDirectory,
    getLinkFromRef
}