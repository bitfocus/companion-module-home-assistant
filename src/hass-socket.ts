/*

This is slightly modified version of
https://github.com/keesschollaart81/vscode-home-assistant/blob/master/src/language-service/src/home-assistant/socket.ts
which is based on
https://github.com/home-assistant/home-assistant-js-websocket/blob/master/lib/socket.ts

*/

import { InstanceBase } from '@companion-module/base'
import * as ha from 'home-assistant-js-websocket'
import * as WebSocket from 'ws'

export function hassErrorToString(e: number): string {
	switch (e) {
		case ha.ERR_CANNOT_CONNECT:
			return 'ERR_CANNOT_CONNECT'
		case ha.ERR_INVALID_AUTH:
			return 'ERR_INVALID_AUTH'
		case ha.ERR_CONNECTION_LOST:
			return 'ERR_CONNECTION_LOST'
		case ha.ERR_HASS_HOST_REQUIRED:
			return 'ERR_HASS_HOST_REQUIRED'
		default:
			return `UNKNOWN ${e}`
	}
}

export async function createSocket(
	auth: ha.Auth,
	ignoreCertificates: boolean,
	instance: InstanceBase<unknown> & { needsReconnect: boolean }
): Promise<ha.HaWebSocket> {
	// Convert from http:// -> ws://, https:// -> wss://
	const url = auth.wsUrl

	instance.log('debug', `[Auth phase] Initializing WebSocket connection to Home Assistant: ${url}`)

	function connect(
		triesLeft: number,
		promResolve: (socket: ha.HaWebSocket) => void,
		promReject: (err: number) => void
	): void {
		if (instance.needsReconnect) {
			// Force rejection, to start again with a new url
			promReject(ha.ERR_CONNECTION_LOST)
			return
		}

		instance.log('debug', `[Auth Phase] Connecting to Home Assistant...: ${url}`)
		instance.updateStatus('connecting')

		const socket = new WebSocket(url, {
			rejectUnauthorized: !ignoreCertificates,
		})

		// If invalid auth, we will not try to reconnect.
		let invalidAuth = false

		const closeMessage = (ev: { wasClean: boolean; code: number; reason: string; target: WebSocket }): void => {
			let msg: string | undefined
			if (ev && ev.code && ev.code !== 1000) {
				msg = `Connection closed with code ${ev.code} and reason ${ev.reason}`
			}
			closeOrError(msg)
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const errorMessage = (ev: { error: any; message: any; type: string; target: WebSocket }): void => {
			// If we are in error handler make sure close handler doesn't also fire.
			socket.removeEventListener('close', closeMessage)
			let msg = 'Disconnected with a WebSocket error'
			if (ev.message) {
				msg += ` with message: ${ev.message}`
			}
			closeOrError(msg)
		}

		const closeOrError = (errorText?: string): void => {
			instance.updateStatus('unknown_error', errorText)
			if (errorText) {
				instance.log('debug', `Connection closed: ${errorText}`)
			}
			if (invalidAuth) {
				promReject(ha.ERR_INVALID_AUTH)
				return
			}

			// Reject if we no longer have to retry
			if (triesLeft === 0) {
				// We never were connected and will not retry
				promReject(ha.ERR_CANNOT_CONNECT)
				return
			}

			const newTries = triesLeft === -1 ? -1 : triesLeft - 1
			// Try again in a second
			setTimeout(() => connect(newTries, promResolve, promReject), 1000)
		}

		// Auth is mandatory, so we can send the auth message right away.
		const handleOpen = (): void => {
			Promise.resolve()
				.then(async () => {
					if (auth.expired) {
						await auth.refreshAccessToken()
					}
					socket.send(
						JSON.stringify({
							type: 'auth',
							access_token: auth.accessToken,
						})
					)
				})
				.catch((err) => {
					// Refresh token failed
					invalidAuth = err === ha.ERR_INVALID_AUTH
					socket.close()
				})
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const handleMessage = (event: { data: any; type: string; target: WebSocket }): void => {
			const message = JSON.parse(event.data)

			instance.log('debug', `[Auth phase] Received a message of type ${message.type}: ${JSON.stringify(message)}`)

			switch (message.type) {
				case ha.MSG_TYPE_AUTH_INVALID:
					invalidAuth = true
					socket.close()
					break

				case ha.MSG_TYPE_AUTH_OK: {
					socket.removeEventListener('open', handleOpen)
					socket.removeEventListener('message', handleMessage)
					socket.removeEventListener('close', closeMessage)
					socket.removeEventListener('error', errorMessage)

					const socket2 = socket as unknown as ha.HaWebSocket
					socket2.haVersion = message.ha_version
					promResolve(socket2)
					break
				}

				default:
					// We already send this message when socket opens
					if (message.type !== ha.MSG_TYPE_AUTH_REQUIRED) {
						instance.log('debug', `[Auth phase] Unhandled message: ${JSON.stringify(message)}`)
					}
			}
		}

		socket.addEventListener('open', handleOpen)
		socket.addEventListener('message', handleMessage)
		socket.addEventListener('close', closeMessage)
		socket.addEventListener('error', errorMessage)
	}

	return new Promise((resolve, reject) => connect(3, resolve, reject))
}
