import retry from './retry'
import axios from 'axios'

export type Options = {
  endpoint?: string
}

const defaultOptions: Options = {
  endpoint: '',
}

export default class Clock {
  _options: Options = {}
  _diff = 0
  ready = false

  constructor(_options?: Options) {
    this._options = Object.assign({}, defaultOptions, _options)
  }

  getTime() {
    // current time on Kadira server
    return this._clientTS() + this._diff
  }

  fixTime(timestamp) {
    // `timestamp` on Kadira server
    return timestamp + this._diff
  }

  sync() {
    // calculate the time difference
    return retry(() => this._syncOnce())
  }

  _clientTS() {
    // Get client timestamp while considering time related
    // libraries messing up the Date object. "Y U DO THIS?"
    const now = Date.now() as number | Date

    if (typeof now === 'number') {
      return now
    }

    // some time related libraries screw up Date.now()
    // and it returns a Date object instead of a number
    if (now instanceof Date) {
      return now.getTime()
    }

    // final attempt to get time
    return new Date().getTime()
  }

  _syncOnce() {
    let startTS

    return this._fetchTime()
      .then(() => {
        startTS = this._clientTS()
        return this._fetchTime()
      })
      .then(serverTS => {
        const latency = (this._clientTS() - startTS) / 2
        this._diff = serverTS - latency - startTS
        this.ready = true
      })
  }

  _fetchTime() {
    return axios.get(this._options.endpoint).then(res => {
      if (res.status !== 200) {
        throw new Error('request failed: ' + res.status)
      }

      return parseInt(res.data, 10)
    })
  }
}
