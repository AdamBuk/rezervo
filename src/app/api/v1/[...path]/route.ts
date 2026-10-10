import { apiError } from "@/lib/api/responses";

// JSON 404 for unknown /api/v1 paths, instead of the HTML not-found page.
function notFound() {
  return apiError(404, "not_found", "Unknown endpoint. See the API documentation in README.md.");
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
