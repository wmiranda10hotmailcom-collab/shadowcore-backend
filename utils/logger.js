const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, JSON.stringify(data, null, 2));
  },
  error: (message, error = {}) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error);
  },
  warn: (message, data = {}) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, JSON.stringify(data, null, 2));
  }
};

module.exports = logger;
