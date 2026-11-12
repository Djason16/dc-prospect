// Every JSON response of the API goes through this helper (same format as the DC Scaffold back ends).
// Success: { "success": true, ...data }
// Error:   { "success": false, "error": "message", "type": "VALIDATION_ERROR" }
import type { ServerResponse } from 'node:http'

export class ResponseHelper {
    static send(res: ServerResponse, code: number, body: string | Buffer | object, type = 'application/json; charset=utf-8'): void {
        res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
    }

    static success(res: ServerResponse, data: object = {}): void {
        ResponseHelper.send(res, 200, { success: true, ...data })
    }

    static error(res: ServerResponse, message: string, code = 400, type = 'VALIDATION_ERROR'): void {
        ResponseHelper.send(res, code, { success: false, error: message, type })
    }

    static html(res: ServerResponse, html: string, code = 200): void {
        ResponseHelper.send(res, code, html, 'text/html; charset=utf-8')
    }
}

// Error thrown by a controller: becomes { success: false, error } with its status
export class ApiError extends Error {
    code: number
    type: string
    constructor(message: string, code = 400, type = 'VALIDATION_ERROR') { super(message); this.code = code; this.type = type }
}

// Message of anything thrown (an Error, or a value thrown by a library)
export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))
