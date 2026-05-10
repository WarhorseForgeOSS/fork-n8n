/* eslint-disable import-x/no-extraneous-dependencies -- test-only Vue mounting */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

import AgentMemoryPanel from '../components/AgentMemoryPanel.vue';
import type { AgentJsonConfig } from '../types';

const { openModalWithDataMock } = vi.hoisted(() => ({
	openModalWithDataMock: vi.fn(),
}));

vi.mock('@n8n/i18n', () => ({
	useI18n: () => ({
		baseText: (key: string) =>
			({
				'agents.builder.memory.title': 'Memory',
				'agents.builder.memory.description':
					'Keeps session context and learned behavior available.',
				'agents.builder.memory.episodicMemory.label': 'Case memory',
				'agents.builder.memory.episodicMemory.hint':
					'Remember source-backed details from previous cases so this agent can recognize similar issues across sessions.',
			})[key] ?? key,
	}),
}));

vi.mock('@/app/stores/ui.store', () => ({
	useUIStore: () => ({ openModalWithData: openModalWithDataMock }),
}));

const globalStubs = {
	N8nText: { template: '<span><slot /></span>', props: ['tag', 'bold', 'size', 'color'] },
	N8nSwitch: {
		props: ['modelValue', 'disabled'],
		emits: ['update:modelValue'],
		template:
			'<button v-bind="$attrs" :disabled="disabled" :data-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />',
	},
};

function makeConfig(overrides: Partial<AgentJsonConfig> = {}): AgentJsonConfig {
	return {
		name: 'A',
		instructions: 'i',
		model: 'anthropic/claude-sonnet-4-6',
		credential: 'c',
		...overrides,
	} as AgentJsonConfig;
}

describe('AgentMemoryPanel', () => {
	beforeEach(() => {
		openModalWithDataMock.mockClear();
	});

	it('renders memory and case memory toggles', () => {
		const wrapper = mount(AgentMemoryPanel, {
			props: { config: makeConfig() },
			global: { stubs: globalStubs },
		});

		expect(wrapper.find('[data-testid="agent-memory-toggle"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="agent-case-memory-toggle"]').exists()).toBe(true);
	});

	it('opens the credential modal without updating config when case memory is toggled on', async () => {
		const wrapper = mount(AgentMemoryPanel, {
			props: { config: makeConfig() },
			global: { stubs: globalStubs },
		});

		await wrapper.find('[data-testid="agent-case-memory-toggle"]').trigger('click');

		expect(openModalWithDataMock).toHaveBeenCalledWith({
			name: 'agentCaseMemoryCredentialModal',
			data: expect.objectContaining({
				initialValue: null,
				onSelect: expect.any(Function),
			}),
		});
		expect(wrapper.emitted('update:config')).toBeUndefined();
	});

	it('enables base memory without opening credential selection', async () => {
		const wrapper = mount(AgentMemoryPanel, {
			props: { config: makeConfig() },
			global: { stubs: globalStubs },
		});

		await wrapper.find('[data-testid="agent-memory-toggle"]').trigger('click');

		expect(openModalWithDataMock).not.toHaveBeenCalled();
		expect(wrapper.emitted('update:config')).toEqual([
			[
				{
					memory: {
						enabled: true,
						storage: 'n8n',
						lastMessages: 10,
					},
				},
			],
		]);
	});

	it('emits the memory config after a credential is selected', async () => {
		const wrapper = mount(AgentMemoryPanel, {
			props: { config: makeConfig() },
			global: { stubs: globalStubs },
		});

		await wrapper.find('[data-testid="agent-case-memory-toggle"]').trigger('click');
		const payload = openModalWithDataMock.mock.calls[0][0] as {
			data: { onSelect: (credentialId: string) => void };
		};
		payload.data.onSelect('credential-1');

		expect(wrapper.emitted('update:config')).toEqual([
			[
				{
					memory: {
						enabled: true,
						storage: 'n8n',
						lastMessages: 10,
						episodicMemory: {
							enabled: true,
							credential: 'credential-1',
						},
					},
				},
			],
		]);
	});

	it('preserves existing memory config when enabling case memory', async () => {
		const wrapper = mount(AgentMemoryPanel, {
			props: {
				config: makeConfig({
					memory: {
						enabled: true,
						storage: 'n8n',
						lastMessages: 4,
						semanticRecall: {
							topK: 3,
							scope: 'resource',
						},
					},
				}),
			},
			global: { stubs: globalStubs },
		});

		await wrapper.find('[data-testid="agent-case-memory-toggle"]').trigger('click');
		const payload = openModalWithDataMock.mock.calls[0][0] as {
			data: { onSelect: (credentialId: string) => void };
		};
		payload.data.onSelect('credential-2');

		const events = wrapper.emitted('update:config') ?? [];
		expect(events[0][0]).toEqual({
			memory: {
				enabled: true,
				storage: 'n8n',
				lastMessages: 4,
				semanticRecall: {
					topK: 3,
					scope: 'resource',
				},
				episodicMemory: {
					enabled: true,
					credential: 'credential-2',
				},
			},
		});
	});

	it('emits disabled memory config when toggled off', async () => {
		const wrapper = mount(AgentMemoryPanel, {
			props: {
				config: makeConfig({
					memory: {
						enabled: true,
						storage: 'n8n',
						lastMessages: 10,
						episodicMemory: {
							enabled: true,
							credential: 'credential-1',
						},
					},
				}),
			},
			global: { stubs: globalStubs },
		});

		await wrapper.find('[data-testid="agent-case-memory-toggle"]').trigger('click');

		expect(openModalWithDataMock).not.toHaveBeenCalled();
		const events = wrapper.emitted('update:config') ?? [];
		expect(events[0][0]).toEqual({
			memory: {
				enabled: true,
				storage: 'n8n',
				lastMessages: 10,
				episodicMemory: { enabled: false },
			},
		});
	});

	it('disables memory controls when the disabled prop is true', () => {
		const wrapper = mount(AgentMemoryPanel, {
			props: { config: makeConfig(), disabled: true },
			global: { stubs: globalStubs },
		});

		expect(
			wrapper.find('[data-testid="agent-memory-toggle"]').attributes('disabled'),
		).toBeDefined();
		expect(
			wrapper.find('[data-testid="agent-case-memory-toggle"]').attributes('disabled'),
		).toBeDefined();
	});
});
