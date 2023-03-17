const getFilename = (json, asPath) => (json ? json.info ? json.info.title : (asPath ? json.title : json.title + 'Schema'): '')
const getDirectory = (json, asPath) => asPath ? json.info ? '' : 'schemas' : ''

export {
    getFilename,
    getDirectory
}