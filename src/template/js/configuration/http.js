Configuration.set('apiBaseUri', '${http.endpoint}')

function _initialize(config, apis) {
  Configuration.set(config)
  Http.setEndpoint(Configuration.get('apiBaseUri'))
  Http.onAuthorize(apis.authorize)
}

export const initialize = window.__firebolt ? () => { throw new Error('Use Extensions.initialize() from \'@firebolt-js/sdk\' to initialize ${sdk.name}.') } : _initialize

window.__firebolt && window.__firebolt.registerExtensionSDK('${sdk.id}', _initialize)