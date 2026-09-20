import { NextResponse } from "next/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

/**
 * API Response Utilities
 * Standardized response format for all API endpoints
 */

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  );
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status: number = 400
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): NextResponse<ApiResponse<PaginatedResponse<T>>> {
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    success: true,
    data: {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
  });
}

/**
 * Create a created response (201)
 */
export function createdResponse<T>(
  data: T,
  message?: string
): NextResponse<ApiResponse<T>> {
  return successResponse(data, message || "Created successfully", 201);
}

/**
 * Create a no content response (204)
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Handle not found
 */
export function notFoundResponse(
  resource: string = "Resource"
): NextResponse<ApiResponse> {
  return errorResponse(`${resource} not found`, 404);
}

/**
 * Handle unauthorized
 */
export function unauthorizedResponse(
  message: string = "Unauthorized"
): NextResponse<ApiResponse> {
  return errorResponse(message, 401);
}

/**
 * Handle forbidden
 */
export function forbiddenResponse(
  message: string = "Forbidden"
): NextResponse<ApiResponse> {
  return errorResponse(message, 403);
}

/**
 * Handle internal server error
 */
export function serverErrorResponse(
  error?: unknown
): NextResponse<ApiResponse> {
  console.error("Server error:", error);
  return errorResponse("Internal server error", 500);
}
