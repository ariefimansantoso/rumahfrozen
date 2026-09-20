/**
 * Validation Helper Utilities
 * Provides unified validation for API routes using Zod schemas
 */

import { z, ZodSchema, ZodError } from "zod";
import { NextRequest } from "next/server";
import { ValidationError } from "./errors";

/**
 * Sanitize search string to prevent ReDoS attacks
 * Escapes all regex special characters
 *
 * Every list endpoint that feeds user input into a MongoDB `$regex` must run
 * it through this first (directly, via SafeSearchSchema, or parseListQuery).
 * Scaling note: those case-insensitive unanchored regexes cannot use B-tree
 * indexes — acceptable at current data sizes, but if a collection grows to
 * tens of thousands of documents, switch its search to a $text index
 * (Product, Vendor, Collection, BlogPost, Cart already define one) or Atlas
 * Search rather than tuning the regex.
 */
export function sanitizeSearchString(input: string): string {
  if (!input) return input;
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convert Zod errors to a structured error object
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  });

  return errors;
}

/**
 * Validate request body against a Zod schema
 * @throws ValidationError if validation fails
 */
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ValidationError({ _root: ["Invalid JSON in request body"] });
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ValidationError(formatZodErrors(result.error));
  }

  return result.data;
}

/**
 * Validate query parameters against a Zod schema
 * @throws ValidationError if validation fails
 */
export function validateQuery<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): z.infer<T> {
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string | string[]> = {};

  // Convert URLSearchParams to object
  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      // Handle array values
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    throw new ValidationError(formatZodErrors(result.error));
  }

  return result.data;
}

/**
 * Validate path parameters (e.g., [id] from URL)
 * @throws ValidationError if validation fails
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string | string[]>,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(params);

  if (!result.success) {
    throw new ValidationError(formatZodErrors(result.error));
  }

  return result.data;
}

/**
 * Validate both body and query in one call
 * Returns { body, query } with validated data
 */
export async function validateRequest<
  TBody extends ZodSchema,
  TQuery extends ZodSchema,
>(
  request: NextRequest,
  schemas: { body?: TBody; query?: TQuery }
): Promise<{
  body: TBody extends ZodSchema ? z.infer<TBody> : undefined;
  query: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
}> {
  const result: {
    body: z.infer<TBody> | undefined;
    query: z.infer<TQuery> | undefined;
  } = {
    body: undefined,
    query: undefined,
  };

  if (schemas.body) {
    result.body = await validateBody(request, schemas.body);
  }

  if (schemas.query) {
    result.query = validateQuery(request, schemas.query);
  }

  return result as {
    body: TBody extends ZodSchema ? z.infer<TBody> : undefined;
    query: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
  };
}

/**
 * Create a safe regex pattern from user input
 * Use this when building MongoDB queries with user-provided search strings
 */
export function createSafeRegex(
  input: string,
  flags: string = "i"
): RegExp {
  return new RegExp(sanitizeSearchString(input), flags);
}

/**
 * Validate MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}
