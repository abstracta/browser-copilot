export const fetchJson = async (url: string, options?: RequestInit) => {
  let ret = await fetchResponse(url, options)
  return await ret.json()
}

const fetchResponse = async (url: string, options?: RequestInit) => {
  let ret = await fetch(url, options)
  if (ret.status < 200 || ret.status >= 300) {
    let body = await ret.text()
    console.warn(`Problem with ${options?.method ? options.method : 'GET'} ${url}`, { status: ret.status, body: body })
    if (ret.headers.get('Content-Type') === 'application/json') {
      let json = JSON.parse(body)
      if ('detail' in json) {
        throw new HttpServiceError(json.detail)
      }
    }
    throw new HttpServiceError()
  }
  return ret
}

export class HttpServiceError extends Error {
  detail?: string

  constructor(detail?: string) {
    super()
    this.detail = detail
  }

}

export async function* fetchStreamJson(url: string, options?: RequestInit): AsyncIterable<any> {
  let resp = await fetchResponse(url, options)
  let contentType = resp.headers.get("content-type")
  if (contentType?.startsWith("text/event-stream")) {
    let ret = await fetchSSEStream(resp, url, options)
    for await (const part of ret) {
      yield part
    }
  } else {
    yield resp.json()
  }
}

async function* fetchSSEStream(resp: Response, url: string, options?: RequestInit): AsyncIterable<any> {
  let reader = resp.body!.getReader()
  let done = false
  while (!done) {
    let result = await reader.read()
    done = result.done
    let events = ServerSentEvent.fromBytes(result.value!)
    for (const event of events) {
      if (event.event === "error") {
        console.warn(`Problem while reading stream response from ${options?.method ? options.method : 'GET'} ${url}`, event)
        throw new HttpServiceError()
      }
      if (event.event) {
        yield JSON.parse(event.data)
      } else {
        yield event.data
      }
    }
  }
}

class ServerSentEvent {
  event?: string
  data: string

  constructor(data: string, event?: string) {
    this.data = data
    this.event = event
  }

  public static fromBytes(bs: Uint8Array): ServerSentEvent[] {
    let text = new TextDecoder("utf-8").decode(bs)
    let events = text.split(/\r\n\r\n/)
    return events.map(e => ServerSentEvent.parseEvent(e))
  }

  private static parseEvent(event: string): ServerSentEvent {
    let parts = event.split(/\r\n/)
    let eventType
    let eventPrefix = "event: "
    if (parts[0].startsWith(eventPrefix)) {
      eventType = parts[0].substring(eventPrefix.length)
    }
    let dataPrefix = "data: "
    let data = parts.filter(p => p.startsWith(dataPrefix)).map(p => p.substring(dataPrefix.length)).join("\n")
    return new ServerSentEvent(data, eventType)
  }
}
