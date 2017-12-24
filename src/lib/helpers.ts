import AppError from './AppError'

type ToPromiseRepose<TResponse> = ((...args: any[]) => Promise<TResponse>)

export function toPromise<TResponse>(
  fn: Function,
): ToPromiseRepose<TResponse>
export function toPromise<TContext, TResponse>(
  obj: TContext,
  method: keyof TContext,
): ToPromiseRepose<TResponse>

/**
 * Transforms a function acception a (err, data) - callback as last argument into a function
 * returning a promise. 
 * @param obj Object context of the function 
 * @param method The name of the function to call
 */
export function toPromise<TContext, TResponse>(
  obj: TContext | Function,
  method?: keyof TContext,
): ToPromiseRepose<TResponse> {
  return (...args: any[]) => {
    const callFn = (
      fn: Function,
      args: any[],
      callback: (err: Error, ...resp: any[]) => void,
    ) => {
      if (typeof obj === 'function') {
        fn(...args, callback)
      } else {
        fn.apply(obj, [...args, callback])
      }
    }
    return new Promise<TResponse>((resolve, reject) => {
      const fn: Function = typeof obj === 'function' ? obj : obj[method!] as any
      if (typeof fn !== 'function') {
        return reject(
          new AppError(
            'invalid_arg',
            `toPromise: ${method} is not a valid function.`,
          ),
        )
      }
      try {
        callFn(fn, args, (err: Error, body: any) => {
          if (err) return reject(err)
          return resolve(body)
        })
      } catch (err) {
        reject(err)
      }
    })
  }
}
