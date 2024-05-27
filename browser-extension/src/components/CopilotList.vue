<script lang="ts" setup>
import { onBeforeMount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CirclePlusIcon, SettingsIcon, TrashXIcon } from 'vue-tabler-icons'
import { findAllAgents, removeAgent } from '../scripts/agent-repository'
import { removeAgentPrompts } from '../scripts/prompt-repository'
import { Agent } from '../scripts/agent'
import ModalForm from './ModalForm.vue'
import CopilotConfig from './CopilotConfig.vue'
import AddCopilotModal from './AddCopilotModal.vue'
import CopilotName from './CopilotName.vue'
import PageOverlay from './PageOverlay.vue'
import BtnClose from './BtnClose.vue'
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'activateAgent', agentId: string): void
}>();
const { t } = useI18n()
const agents = ref<Agent[]>()
const showAddCopilot = ref(false)
const configAgent = ref<Agent>()
const deletingIndex = ref(-1)

onBeforeMount(async () => {
  agents.value = await findAllAgents()
});

const removeCopilot = (index: number) => {
  deletingIndex.value = index
};

const closeDeletionConfirmation = () => {
  deletingIndex.value = -1
};

const confirmRemoval = async () => {
  let agent = agents.value![deletingIndex.value]
  let agentId = agent.manifest.id
  await removeAgent(agentId)
  await removeAgentPrompts(agentId)
  agents.value!.splice(deletingIndex.value, 1)
  closeDeletionConfirmation()
};

const onCopilotAdded = (agent: Agent) => {
  agents.value!.push(agent)
  showAddCopilot.value = false
};
</script>

<template>
  <PageOverlay>
    <template v-slot:headerContent>
      <div class="text-xl font-semibold">{{ t('title') }}</div>
    </template>
    <template v-slot:headerActions>
      <BtnClose @click="$emit('close')" />
    </template>
    <template v-slot:content>
      <div class="flex flex-row py-3">
        <div class="flex items-center text-base cursor-pointer" @click="showAddCopilot = true"><circle-plus-icon />{{ t('addTitle') }}</div>
      </div>
      <div v-for="(agent, index) in agents" :key="agent.manifest.id" class="flex flex-row py-3 ">
        <div class="flex flex-row flex-auto self-center items-center cursor-pointer" @click="$emit('activateAgent', agent.manifest.id)">
          <img :src="agent.logo" class="w-7 h-7" />
          <div class="text-lg font-bold">
            <CopilotName :agent-name="agent.manifest.name" />
          </div>
        </div>
        <button @click="configAgent = agent">
            <settings-icon class="action-icon" />
          </button>
        <button @click="removeCopilot(index)">
          <trash-x-icon class="action-icon" />
        </button>
      </div>
    </template>
    <template v-slot:modalsContainer>
      <ModalForm :title="t('removeTitle')" :show="deletingIndex >= 0" @close="closeDeletionConfirmation" @save="confirmRemoval" :button-text="t('removeButton')">
        {{
          t('removeConfirmation', {
            agentName: agents ? agents[deletingIndex].manifest.name : ''
          })
        }}
      </ModalForm>
      <CopilotConfig :show="configAgent !== undefined" @close="configAgent = undefined" :agent-id="configAgent?.manifest.id || ''" :agent-name="configAgent?.manifest.name || ''" :agent-logo="configAgent?.logo || ''" />
      <AddCopilotModal :show="showAddCopilot" @close="showAddCopilot = false" @saved="onCopilotAdded" />
    </template>
  </PageOverlay>
</template>

<i18n>
  {
    "en": {
      "title": "My copilots",
      "addTitle": "Add copilot",
      "removeTitle": "Remove copilot",
      "removeButton": "Remove",
      "removeConfirmation": "Are you sure you want to remove the copilot {agentName}?"
    },
    "es" : {
      "title": "Mis copilotos",
      "addTitle": "Agregar copiloto",
      "removeTitle": "Quitar copiloto",
      "removeButton": "Quitar",
      "removeConfirmation": "¿Estás seguro de borrar el copiloto {agentName}?"
    }
  }
</i18n>
