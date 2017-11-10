export default class AppError extends Error {
  constructor(message: string, public readonly context?: {}) {
    super(message);
  }
}