let toastCallback = null;

export const toast = {
  success(message, duration = 4000) {
    if (toastCallback) {
      toastCallback(message, 'success', duration);
    } else {
      console.log('Success Toast:', message);
    }
  },
  error(message, duration = 4000) {
    if (toastCallback) {
      toastCallback(message, 'error', duration);
    } else {
      console.error('Error Toast:', message);
    }
  },
  register(callback) {
    toastCallback = callback;
    return () => {
      if (toastCallback === callback) {
        toastCallback = null;
      }
    };
  }
};
