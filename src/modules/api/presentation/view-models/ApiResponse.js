class ApiResponse {
  static success(data, message = 'Operación exitosa') {
    return {
      success: true,
      data,
      message,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  static error(message, statusCode = 500, details = null) {
    return {
      success: false,
      data: null,
      error: {
        message,
        statusCode,
        details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = ApiResponse;
