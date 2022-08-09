const config = {}

function set(name, value) {
    // if the only argument is an object, copy all of the values in
    if (name && !value && typeof name === 'object') {
        Object.assign(config, name)
    }
    else {
        config[name] = value
    }
}

function get(name) {
    if (!name) {
        return JSON.parse(JSON.stringify(config))
    }
    else {
        return config[name]
    }
}

export default {
    get,
    set
}