  /**
   * Listen for the first of any and all events dispatched by this module.
   * 
   * @param {Function} callback
   */
  function once(callback: (event: string, data: any) => void): Promise<number>