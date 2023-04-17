    /**
     * ${method.summary}
     * 
     * @param {'${event.name}'} event
     * @param {Function} callback
     */
    function listen(event: '${event.name}', callback: (data: ${method.result.type}) => void): Promise<number>

    /**
     * ${method.summary}
     * When using `once` the callback method will only fire once, and then disconnect your listener
     * 
     * @param {'${event.name}'} event
     * @param {Function} callback
     */
    function once(event: '${event.name}', callback: (data: ${method.result.type}) => void): Promise<number>
