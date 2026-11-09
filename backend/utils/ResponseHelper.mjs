// Every JSON response of the API goes through this helper (same format as the DC Scaffold back ends).
// Success: { "success": true, ...data }
// Error:   { "success": false, "error": "message", "type": "VALIDATION_ERROR" }
export class ResponseHelper {
    static send(res, code, body, type = 'application/json; charset=utf-8') {
        res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
    }

    static success(res, data = {}) {
        ResponseHelper.send(res, 200, { success: true, ...data })
    }

    static error(res, message, code = 400, type = 'VALIDATION_ERROR') {
        ResponseHelper.send(res, code, { success: false, error: message, type })
    }

    static html(res, html, code = 200) {
        ResponseHelper.send(res, code, html, 'text/html; charset=utf-8')
    }
}

// Error thrown by a controller: becomes { success: false, error } with its status
export class ApiError extends Error {
    constructor(message, code = 400, type = 'VALIDATION_ERROR') { super(message); this.code = code; this.type = type }
}
