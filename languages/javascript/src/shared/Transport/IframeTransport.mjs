export default class IframeTransport {

    constructor() {
        this._initialized = false
        this._callbacks = []
    }

    init() {
        window.addEventListener('message', event => {
            if (IframeTransport.isJsonRpcMessage(event.data)) {
                this._notifyCallbacks(event.data)
            }
        })
        this._initialized = true
    }

    send(msg) {
        if (!this._initialized) this.init()
        window.parent.postMessage(msg, "*")
    }

    receive(callback) {
        if (!callback) return
        if (!this._initialized) this.init()
        this._callbacks.push(callback)
    }

    _notifyCallbacks(message) {
        for (let i = 0; i < this._callbacks.length; i++) {
            setTimeout(() => this._callbacks[i](message), 1)
        }
    }

    static inIframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    static isJsonRpcMessage(message) {
        try {
            let m = JSON.parse(message)
            return m.jsonrpc != null
        } catch (err) { }
        return false
    }
}