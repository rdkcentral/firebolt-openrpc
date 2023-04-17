  /**
   * Listen to all events dispatched by this module.
   * 
   * @param {Function} callback
   */
  function listen(callback: (event: string, data: any) => void): Promise<number>