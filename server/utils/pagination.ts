/**
 * Pagination Utilities
 * 
 * Standardized pagination for list endpoints
 */

import { Request } from 'express';

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function parsePaginationParams(req: Request): PaginationParams {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  
  return { limit, offset };
}

export function createPaginationMeta(
  total: number, 
  limit: number, 
  offset: number
): PaginationMeta {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
