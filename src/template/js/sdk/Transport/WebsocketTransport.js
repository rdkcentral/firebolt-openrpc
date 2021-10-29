const MAX_QUEUED_MESSAGES = 100
const WRAP_METHOD = 'org.firebolt.Firebolt.1.call'

export default class WebsocketTransport {
  constructor (wrap = false) {
    this._wrap = wrap
    this._ws = null
    this._connected = false
    this._queue = []
    this._callbacks = []
  }

  send (msg) {
    this._connect()
    const wsMsg = this._wrap ? this._wrapMessage(msg) : msg

    if (this._connected) {
      this._ws.send(wsMsg)
    } else {
      if (this._queue.length < MAX_QUEUED_MESSAGES) {
        this._queue.push(wsMsg)
      }
    }
  }

  receive (callback) {
    this._connect()
    this._callbacks.push(callback)
  }

  _wrapMessage (msg) {
    return JSON.stringify({
      jsonrpc: '2.0',
      method: WRAP_METHOD,
      params: {
        payload: msg
      }
    })
  }

  _notifyCallbacks (message) {
    for (let i = 0; i < this._callbacks.length; i++) {
      setTimeout(() => this._callbacks[i](message), 1)
    }
  }

  _connect () {
    if (this._ws) return
    this._ws = new WebSocket(this._apiTarget())
    this._ws.addEventListener('message', message => {
      this._notifyCallbacks(message.data)
    })
    this._ws.addEventListener('error', message => {
    })
    this._ws.addEventListener('close', message => {
      this._ws = null
      this._connected = false
    })
    this._ws.addEventListener('open', message => {
      this._connected = true
      for (let i = 0; i < this._queue.length; i++) {
        this._ws.send(this._queue[i])
      }
      this._queue = []
    })
  }

  _apiTarget () {
    if (window.apiTarget) {
      return apiTarget
    }
    return this._defaultApiTarget()
  }

  _defaultApiTarget () {
    let fbTransToken = new URLSearchParams(window.location.search).get('_fbTransToken')
    if (fbTransToken == null) {
      if (window && window.thunder && (typeof window.thunder.token === 'function')) {
        fbTransToken = window.thunder.token()
      }
    }
    let target = 'ws://127.0.0.1:9998?token='
    if (fbTransToken) {
      target += fbTransToken
    }
    return target
  }

}