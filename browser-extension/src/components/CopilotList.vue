<script lang="ts" setup>
import { onBeforeMount, ref } from "vue"
import { useI18n } from "vue-i18n"
import { findAllAgents, removeAgent } from "../scripts/agent-repository"
import { removeAgentPrompts } from "../scripts/prompt-repository"
import { Agent } from "../scripts/agent"
import ModalForm from "./ModalForm.vue"
import CopilotConfig from "./CopilotConfig.vue"
import AddCopilot from "./AddCopilot.vue"
import CopilotName from "./CopilotName.vue"
import Footer from "./Footer.vue"

const emit = defineEmits<{
  (e: "close"): void
  (e: "activateAgent", agentId: string): void
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
  <div class="min-h-screen flex flex-col">
    <main class="flex-grow">
      <div class="header items-center py-3 px-1.5 copilot-list-header">
        <div class="text-[20px] font-semibold">{{ t('title') }}</div>
        <div class="actions">
          <button @click="$emit('close')"><x-icon /></button>
        </div>
      </div>
      <div class="border-t border-gray-300 absolute left-0 right-0"></div>
      <div class="copilot-list">
        <div class="list-row">
          <div class="flex items-center py-4 text-base cursor-pointer" @click="showAddCopilot = true">
            <circle-plus-icon />{{ t('addTitle') }}
          </div>
        </div>
        <div v-for="(agent, index) in agents" :key="agent.manifest.id" class="list-row">
          <div class="copilot-item list-item items-center py-3" @click="$emit('activateAgent', agent.manifest.id)">
            <img :src="agent.logo" style="width: 25px; height: 25px" />
            <div class="copilot-name">
              <CopilotName :agent-name="agent.manifest.name" />
            </div>
          </div>
          <div class="copilot-item-actions px-3">
            <button @click="configAgent = agent"><settings-icon class="action-icon" /></button>
            <button @click="removeCopilot(index)"><trash-x-icon class="action-icon" /></button>
          </div>
        </div>
      </div>
    </main>
    <Footer class="py-10" />
    <ModalForm :title="t('removeTitle')" :show="deletingIndex >= 0" @close="closeDeletionConfirmation"
      @save="confirmRemoval" :button-text="t('removeButton')">
      {{ t('removeConfirmation', { agentName: agents ? agents[deletingIndex].manifest.name : "" }) }}
    </ModalForm>
    <CopilotConfig :show="configAgent !== undefined" @close="configAgent = undefined"
      :agent-id="configAgent?.manifest.id || ''" :agent-name="configAgent?.manifest.name || ''"
      :agent-logo="configAgent?.logo || ''" />
    <AddCopilot :show="showAddCopilot" @close="showAddCopilot = false" @saved="onCopilotAdded" />
  </div>
</template>

<style>
.copilot-list-header {
  display: flex;
  flex-direction: row;
}

.copilot-list {
  list-style: none;
}

div.copilot-item {
  cursor: pointer;
  display: flex;
  flex-direction: row;
}

div.copilot-name {
  align-self: center;
  font-size: large;
  font-weight: bold;
}

div.copilot-item-actions {
  display: flex;
  flex-direction: row;
}
</style>

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
