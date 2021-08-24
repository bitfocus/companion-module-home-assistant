import { HassEntities } from 'home-assistant-js-websocket'
import InstanceSkel = require('../../../instance_skel')
import { CompanionVariable } from '../../../instance_skel_types'
import { DeviceConfig } from './config'

export function updateVariables(instance: InstanceSkel<DeviceConfig>, state: HassEntities): void {
	const variables: { [variableId: string]: string | undefined } = {}
	for (const entity of Object.values(state)) {
		variables[`entity.${entity.entity_id}`] = entity.attributes.friendly_name ?? entity.entity_id
		if (entity.entity_id.indexOf('light.') != -1) {
			variables[`entity.${entity.entity_id}.brightness`] = String(
				Math.round((100 * (entity.attributes.brightness ?? 0)) / 256)
			)
		}
	}

	instance.setVariables(variables)
}

export function InitVariables(instance: InstanceSkel<DeviceConfig>, state: HassEntities): void {
	const variables: CompanionVariable[] = []

	for (const entity of Object.values(state)) {
		variables.push({
			label: `Entity: ${entity.attributes.friendly_name ?? entity.entity_id}`,
			name: `entity.${entity.entity_id}`,
		})
		if (entity.entity_id.indexOf('light.') != -1) {
			variables.push({
				label: `${entity.attributes.friendly_name ?? entity.entity_id} brightness`,
				name: `entity.${entity.entity_id}.brightness`,
			})
		}
	}

	instance.setVariableDefinitions(variables)
}
