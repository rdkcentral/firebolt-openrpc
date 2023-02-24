const logSuccess = message => console.log(`\x1b[32m ✓ \x1b[0m\x1b[2m ${message}\x1b[0m`)
const logInfo = message => console.log(`\x1b[38;5;202m ⓘ \x1b[0m\x1b[2m ${message}\x1b[0m`)
const logError = message => console.log(`\x1b[31m ✗ \x1b[0m\x1b[2m ${message}\x1b[0m`)
const logHeader = message => console.log(`\x1b[0m\x1b[7m\x1b[32m${message}\x1b[0m\n`)

export {
    logSuccess,
    logInfo,
    logError,
    logHeader
}