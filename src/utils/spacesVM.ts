import { tryNTimes } from './tryNTimes'

import { API_DOMAIN } from '@/constants'
import { SpaceKeyValue, TransactionInfo } from '@/types'

export const fetchSpaces = async (method: string, params = {}) => {
	const response = await fetch(`${API_DOMAIN}`, {
		headers: {
			'Content-Type': 'application/json',
		},
		method: 'POST',
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: `spacesvm.${method}`,
			params,
			id: 1,
		}),
	})
	const reader = response.body?.getReader()
	const encodedData = await reader?.read()
	if (encodedData?.value === undefined) return
	const data = JSON.parse(new TextDecoder().decode(encodedData?.value))
	if (data.error) throw data.error
	return data?.result
}

/**
 * Pings SpacesVM returns whether connected or not
 */
export const isConnectedToSpacesVM = async (): Promise<boolean> => {
	try {
		const { success } = await fetchSpaces('ping')
		return success
	} catch {
		return false
	}
}

export const querySpace = async (space: string) => {
	try {
		const response = await fetchSpaces('info', {
			space,
		})
		return {
			...response,
			values: response.values.map(({ key, value }: SpaceKeyValue) => ({ key, value: atob(value) })),
		}
	} catch (err) {
		return
	}
}

export const querySpaceKey = async (prefix: string, key: string) => {
	const response = await fetchSpaces('resolve', { path: `${prefix}/${key}` })
	if (!response?.exists) return
	return atob(response?.value)
}

export const getLatestBlockID = async () => {
	const blockData = await fetchSpaces('lastAccepted')
	return blockData?.blockId
}

export const isAlreadyClaimed = async (space: string) => {
	const response = await fetchSpaces('claimed', {
		space,
	})
	if (!response) throw 'Unable to validate space'
	return response.claimed
}

// Requests for the estimated difficulty from VM.
export const estimateDifficulty = async () => await fetchSpaces('difficultyEstimate')

export const getAddressBalance = async (address: string) => fetchSpaces('balance', { address }) // some random balance for now

/**
 * Query spacesVM to get the fee for a transaction, and the typedData that needs to be signed
 * in orde to submit the transaction
 *
 * @param transactionInfo Object containing type, space, units, key, value, and to (some optional)
 * @returns Object wit
 */
export const getSuggestedFee = async (transactionInfo: TransactionInfo) =>
	await fetchSpaces('suggestedFee', { input: transactionInfo })

/**
 * Issues a transaction to spacesVM.  Used for claim, lifeline, set, delete, move, and transfer
 * https://github.com/ava-labs/spacesvm#transaction-types
 *
 * @param typedData typedData from getSuggestedFee
 * @param signature signed typedData
 * @returns if successful, response has a txId
 */
export const issueTransaction = async (typedData: any, signature: string) =>
	await fetchSpaces('issueTx', { typedData, signature })

export const issueAndConfirmTransaction = async (typedData: any, signature: string): Promise<boolean> => {
	const txResponse = await fetchSpaces('issueTx', { typedData, signature })
	if (!txResponse?.txId) return false

	const checkIsAccepted = async () => {
		try {
			const { accepted } = await fetchSpaces('hasTx', { txId: txResponse.txId })
			if (accepted) return true
			throw 'Transaction has not yet been accepted.'
		} catch (error) {
			throw 'Failed to fetch.'
		}
	}

	try {
		const response = await tryNTimes(checkIsAccepted, 20, 500)
		if (response) return true
	} catch {
		return false
	}
	return false
}

export const hasTransaction = async (txId: string) => {
	try {
		const { accepted } = await fetchSpaces('hasTx', { txId })
		if (accepted) return true
		throw 'Not yet accepted'
	} catch (error) {
		throw 'Not yet accepted'
	}
}
