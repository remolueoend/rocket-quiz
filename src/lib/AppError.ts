export default class AppError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly context?: {},
  ) {
    super(message)
  }
}
