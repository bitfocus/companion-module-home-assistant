import { HassEntities } from 'home-assistant-js-websocket'
import {
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
} from '../../../instance_skel_types'
import { OnOffToggle } from './util'

export function OnOffTogglePicker(): CompanionInputFieldDropdown {
	const options = [
		{ id: OnOffToggle.On, label: 'On' },
		{ id: OnOffToggle.Off, label: 'Off' },
		{ id: OnOffToggle.Toggle, label: 'Toggle' },
	]
	return {
		type: 'dropdown',
		label: 'State',
		id: 'state',
		default: OnOffToggle.On,
		choices: options,
	}
}

export function OnOffPicker(): CompanionInputFieldCheckbox {
	return {
		type: 'checkbox',
		label: 'State',
		id: 'state',
		default: true,
	}
}

export function PctText(): CompanionInputFieldTextInput {
	return {
		type: 'textinput',
		label: 'Adjustment',
		id: 'pct',
		default: '0',
		required: true,
	}
}

export function EntityPicker(state: HassEntities, prefix: string): CompanionInputFieldDropdown {
	const entities = Object.values(state).filter((ent) => ent.entity_id.indexOf(`${prefix}.`) === 0)
	return {
		type: 'dropdown',
		label: 'Entity',
		id: 'entity_id',
		default: entities[0] ? entities[0].entity_id : '',
		choices: entities
			.map((ent) => ({
				id: ent.entity_id,
				label: ent.attributes.friendly_name || ent.entity_id,
			}))
			.sort((a, b) => {
				const a2 = a.label.toLowerCase()
				const b2 = b.label.toLowerCase()
				return a2 === b2 ? 0 : a2 < b2 ? -1 : 1
			}),
	}
}
