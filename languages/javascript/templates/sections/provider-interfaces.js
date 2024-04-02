// Provider Interfaces

interface ProviderSession {
    correlationId(): string        // Returns the correlation id of the current provider session
}

interface FocusableProviderSession extends ProviderSession {
    focus(): Promise<void>         // Requests that the provider app be moved into focus to prevent a user experience
}

${providers.list}