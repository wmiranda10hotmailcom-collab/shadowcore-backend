function sendSuccess(res, message, data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data
  });
}

function sendError(res, error, status = 500, details = null) {
  console.error(`[API ERROR] Status ${status}:`, error, details);
  return res.status(status).json({
    success: false,
    error: typeof error === 'string' ? error : error.message,
    details: details || error.stack || null
  });
}

module.exports = { sendSuccess, sendError };
