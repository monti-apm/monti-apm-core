import retry, { ByPassRetryError } from './retry'
import axios, { AxiosResponse } from 'axios'
import debug from 'debug'
import { HttpMethod, SupportedFeatures } from './constants'

const logger = debug('kadira-core:transport')

export function getAxiosConfig(params) {
  return {
    ...params,
    // Axios defaults to 10mb. Increases limit to 100mb.
    maxBodyLength: 100 * 1024 * 1024,
    method: params.method || HttpMethod.POST,
    maxRedirects: 0,
  }
}

export function axiosRetry(url, params, retryOptions): Promise<AxiosResponse> {
  let retryEnabled = true

  if (params.noRetry) {
    retryEnabled = false
    delete params.noRetry
  }

  return retry(() => {
    return new Promise((resolve, reject) => {
      axios(url, getAxiosConfig(params))
        .then(res => {
          return resolve(res)
        })
        .catch(err => {
          if (err.response && err.response.status) {
            const status = err.response.status

            if (status === 401) {
              logger('Error: Unauthorized')
              return reject(new ByPassRetryError('Unauthorized'))
            } else if (status >= 400 && status < 500) {
              const message = `Agent Error: ${status}`
              logger(`Error: ${message}`)
              return reject(new ByPassRetryError(message))
            }

            const message = `Request failed: ${status}`
            const ErrConstructor = retryEnabled ? Error : ByPassRetryError

            logger(`Error: ${message}`)
            return reject(new ErrConstructor(message))
          }

          if (!retryEnabled) {
            const oldErr = err
            // eslint-disable-next-line no-param-reassign
            err = new ByPassRetryError(oldErr.message)
            err.stack = oldErr.stack
          }

          return reject(err)
        })
    })
  }, retryOptions)
}

export function parseAllowedFeaturesHeader(header) {
  const result = {}

  if (header) {
    header.split(',').map(feature => {
      if (SupportedFeatures[feature]) {
        result[feature] = true
      }
    })
  }

  return result
}

export function stringifySupportedFeatures(features) {
  return Object.entries(features)
    .reduce((acc, [key, value]) => {
      if (value) {
        acc.push(key)
      }

      return acc
    }, [])
    .join(',')
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
