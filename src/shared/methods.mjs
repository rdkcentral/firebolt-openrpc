const tag = (method, name) => method.tags.find(tag => tag.name === name)
export const capabilities = method => tag(method, 'capabilities')
export const provides = method => capabilities(method)['x-provides']
export const pusher = method => capabilities(method)['x-push']
export const notifier = method => method.tags.find(t => t.name === 'notifier')
export const event = method => tag(method, 'event')