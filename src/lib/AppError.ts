export default class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: {},
  ) {
    super(message)
  }
}
