/**
 * JSON RPC Handler Utilities
 */

import { Response } from 'express';
import {
  AllowedSchema,
  ValidationError,
  Validator,
} from 'express-json-validator-middleware';

interface JsonRpcError {
  code: number;
  message: string;
  data: any[];
}

export type LogicFunction = (params?: any) => Promise<any>;
export type Schema = AllowedSchema | null;
export type LogicFunctionMap = {
  [key: string]: {
    logicFunction: LogicFunction;
    schema: Schema;
  };
};

/**
 * Handle JSON RPC errors
 *
 * @param res - Express response
 * @param error - Error to handle
 * @param id - JSON RPC request id
 */
export const handleJsonRpcError = (res: Response, error: Error, id: string) => {
  res.status(500).json({
    jsonrpc: '2.0',
    error: { code: -32603, message: error.message },
    id,
  });
};

export function formatJsonRpcError(error: ValidationError): JsonRpcError {
  // Format the validation error for JSON-RPC response
  const errorDetails = error.validationErrors.body ?? [];
  return { code: -32602, message: 'Invalid params', data: errorDetails };
}
