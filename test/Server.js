import http from 'http'
import dns from 'dns'

const lookup = dns.lookup

const config = (await import(process.env.npm_package_json, { assert: {type: "json" }})).default
const name = 'firebolt-' + config.name.split('/').pop().split('-').shift()
const rpcPath = process.env.npm_config_local_prefix + '/dist/' + name + '-open-rpc.json'
const rpc = (await import(rpcPath, {assert: { type: "json" }})).default
const endpoint = (rpc.info['x-http-endpoint'] || "http://localhost/").replace(/^https:/, 'http:')
const domain = new URL(endpoint).hostname
const port = parseInt(new URL(endpoint).port) || 80
const httpTag = m => m.tags && m.tags.find(t => t.name === 'http')
const httpPath = m => httpTag(m) && httpTag(m)['x-http-path']

console.log(`x-http-endpoing: ${rpc.info['x-http-endpoint']}`)
console.log(`endpoint: ${endpoint}`)
console.log(`domain: ${domain}`)
console.log(`port: ${port}`)
console.log(typeof port)

dns.lookup = function (...args) {
    if (args[0] === domain) {
        console.log(`spoofing domain ${domain} to localhost`)
        return args.pop()(null, '127.0.0.1', 4)
    }
    else {
        return lookup(...args)
    }
}

async function setup() {
    return new Promise((resolve, reject) => {       
        
        const process = (request, response) => {
            const requestPath = request.url.split(endpoint).pop()
            const method = rpc.methods.find(m => {
                const tag = httpTag(m)
                let path = tag && httpPath(m)

                if (path.endsWith('/')) {
                    path = path.substr(0, path.length-1)
                }

                console.log(path + " <-> " + requestPath)

                return path && requestPath.startsWith(path.split("$")[0])
            })

            console.dir(request.headers)
            console.dir(request.body)
            console.dir(request.url)

            response.setHeader("Content-Type", "application/json")
            response.writeHead(200)
            console.dir(method)
            if (method) {
                response.write(JSON.stringify(method.examples[0].result.value))
            }
            else {
                response.write('{}')
            }
            response.end()
        }
        
        const server = http.createServer(process);
        
        server.listen(port, () => {
            console.log("Firebolt Server Started")
            resolve()
        });    
    })
}

export default async function(globalConfig, projectConfig) {
    await setup()
    return
}