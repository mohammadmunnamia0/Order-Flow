// Error thrown by the local data layer. It mimics the shape of an axios error
// (`err.response.status`, `err.response.data.message`) so pages can keep
// handling failures exactly as they did when talking to the old REST server.
export default class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.response = { status, data: { message, ...(errors && { errors }) } };
  }
}
