export const fetchJson = async (url: string, options?: RequestInit) => {
  let fetchResp = await fetch(url, options)
  if (fetchResp.status < 200 || fetchResp.status >=300) {
      let respBody = await fetchResp.text
      throw Error(`Got unexpected response ${fetchResp.status}:\n${respBody}`)
  }
  return await fetchResp.json()
}

export const postJson = async (url: string, body: any) : Promise<any> => {
  return await fetchJson(url, {
      method: "POST",
      headers: {
          "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
  })
}
