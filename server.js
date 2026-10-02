import http from 'node:http'
import process from 'node:process'
import { Buffer } from 'node:buffer'

const port = Number(process.env.API_PORT || 3001)
const pendingPayments = new Map()
const destinations = new Map([
  [1, { name: 'Amboseli National Park', amount: 200000 }],
  [2, { name: 'Maasai Mara National Reserve', amount: 300000 }],
  [3, { name: 'Diani Beach', amount: 150000 }],
  [4, { name: 'Lamu Island', amount: 250000 }],
  [5, { name: 'Lake Nakuru', amount: 180000 }],
  [6, { name: 'Tsavo East', amount: 220000 }],
  [7, { name: 'Nairobi City', amount: 120000 }],
  [8, { name: 'Naivasha', amount: 160000 }],
  [9, { name: 'Mombasa Coast', amount: 170000 }],
])

const getApiBaseUrl = () => process.env.DARAJA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke'

const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

const readJson = async (request) => {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 16_384) throw new Error('Request body is too large.')
  }
  return JSON.parse(body || '{}')
}

const normalizePhoneNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`
  if (/^254[17]\d{8}$/.test(digits)) return digits
  return null
}

const getDarajaConfigError = () => {
  const required = ['DARAJA_CONSUMER_KEY', 'DARAJA_CONSUMER_SECRET', 'DARAJA_SHORTCODE', 'DARAJA_PASSKEY', 'DARAJA_CALLBACK_URL']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) return `Configure these server environment variables: ${missing.join(', ')}.`

  try {
    const callbackUrl = new URL(process.env.DARAJA_CALLBACK_URL)
    if (callbackUrl.protocol !== 'https:' || /localhost|127\.0\.0\.1/.test(callbackUrl.hostname)) {
      return 'DARAJA_CALLBACK_URL must be a publicly reachable HTTPS URL.'
    }
  } catch {
    return 'DARAJA_CALLBACK_URL must be a valid public HTTPS URL.'
  }

  return null
}

const getAccessToken = async () => {
  const credentials = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64')
  const response = await fetch(`${getApiBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15_000),
  })
  const body = await response.json()
  if (!response.ok || !body.access_token) {
    throw new Error(body.errorMessage || 'Daraja authentication failed. Check your credentials and environment.')
  }
  return body.access_token
}

const getNairobiTimestamp = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`
}

const handleStkPush = async (request, response) => {
  const configError = getDarajaConfigError()
  if (configError) return json(response, 503, { error: configError })

  let body
  try {
    body = await readJson(request)
  } catch (error) {
    return json(response, 400, { error: error.message || 'Invalid request body.' })
  }

  const destinationId = Number(body.destinationId)
  const destination = destinations.get(destinationId)
  const phoneNumber = normalizePhoneNumber(body.phoneNumber)
  if (!destination) return json(response, 400, { error: 'Choose a valid travel package.' })
  if (!phoneNumber) return json(response, 400, { error: 'Enter a valid Kenyan Safaricom number, for example 0712345678.' })

  try {
    const accessToken = await getAccessToken()
    const timestamp = getNairobiTimestamp()
    const shortcode = process.env.DARAJA_SHORTCODE
    const password = Buffer.from(`${shortcode}${process.env.DARAJA_PASSKEY}${timestamp}`).toString('base64')
    const stkResponse = await fetch(`${getApiBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: destination.amount,
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: process.env.DARAJA_CALLBACK_URL,
        AccountReference: `TRAVEL-${destinationId}`,
        TransactionDesc: `Booking ${destinationId}`,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const result = await stkResponse.json()

    if (!stkResponse.ok || result.ResponseCode !== '0' || !result.CheckoutRequestID) {
      return json(response, 502, { error: result.errorMessage || result.ResponseDescription || 'Safaricom could not start the payment request.' })
    }

    pendingPayments.set(result.CheckoutRequestID, {
      status: 'pending',
      amount: destination.amount,
      destinationId,
      destinationName: destination.name,
      receiptNumber: null,
      message: null,
    })

    return json(response, 202, {
      checkoutRequestId: result.CheckoutRequestID,
      customerMessage: result.CustomerMessage || 'Payment request sent. Check your phone and enter your M-Pesa PIN.',
    })
  } catch (error) {
    return json(response, 502, { error: error.message || 'Unable to contact the Daraja API.' })
  }
}

const handleCallback = async (request, response) => {
  try {
    const body = await readJson(request)
    const callback = body?.Body?.stkCallback
    if (callback?.CheckoutRequestID) {
      const payment = pendingPayments.get(callback.CheckoutRequestID)
      if (payment) {
        const metadata = callback.CallbackMetadata?.Item || []
        const receipt = metadata.find((item) => item.Name === 'MpesaReceiptNumber')?.Value
        payment.status = Number(callback.ResultCode) === 0 ? 'succeeded' : 'failed'
        payment.receiptNumber = receipt ? String(receipt) : null
        payment.message = callback.ResultDesc || (payment.status === 'failed' ? 'Payment was not completed.' : null)
      }
    }
  } catch (error) {
    console.error('Could not process Daraja callback:', error.message)
  }

  return json(response, 200, { ResultCode: 0, ResultDesc: 'Accepted' })
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json(response, 200, { ok: true, darajaConfigured: !getDarajaConfigError() })
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/stk') {
    return handleStkPush(request, response)
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/callback') {
    return handleCallback(request, response)
  }

  const statusMatch = url.pathname.match(/^\/api\/payments\/status\/([^/]+)$/)
  if (request.method === 'GET' && statusMatch) {
    const payment = pendingPayments.get(decodeURIComponent(statusMatch[1]))
    if (!payment) return json(response, 404, { error: 'Payment request not found.' })
    return json(response, 200, {
      status: payment.status,
      amount: payment.amount,
      receiptNumber: payment.receiptNumber,
      message: payment.message,
    })
  }

  return json(response, 404, { error: 'Not found.' })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Daraja API listening on http://localhost:${port}`)
})
