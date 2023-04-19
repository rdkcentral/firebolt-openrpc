  /**
   * Listen to all events dispatched by this module.
   * 
   * @param {Function} callback
   */
  function listen(callback: (event: string, data: object) => void): Promise<number>