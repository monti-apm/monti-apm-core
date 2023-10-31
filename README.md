# Monti APM Core

This is a fork of [monti-core](https://github.com/montihq/monti-core).

Handle core functionalities of Monti APM such as

* Transport
* NTP Time syncing

### Monti APM Transport Debugging

You can debug what's happening inside the Monti APM transport by exposing following environment variable:

```
export `DEBUG=monti-apm-core:transport`
```
